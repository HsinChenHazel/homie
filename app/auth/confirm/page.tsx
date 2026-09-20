'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AuthConfirmPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  useEffect(() => {
    async function confirmAuth() {
      const tokenHash = searchParams.get('token_hash')
      const type = searchParams.get('type')
      const nextParam = searchParams.get('next')

      const next =
        nextParam && nextParam.startsWith('/')
          ? nextParam
          : '/reset-password'

      if (!tokenHash || type !== 'recovery') {
        router.replace('/forgot-password?error=invalid-link')
        return
      }

      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: 'recovery',
      })

      if (error) {
        console.error('verifyOtp error:', error.message)
        router.replace('/forgot-password?error=invalid-link')
        return
      }

      router.replace(next)
      router.refresh()
    }

    confirmAuth()
  }, [router, searchParams, supabase])

  return null
}