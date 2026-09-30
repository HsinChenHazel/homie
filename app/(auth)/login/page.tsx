'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { Button, Card, Form, Input, Divider, Alert } from 'antd'
import { MailOutlined, LockOutlined } from '@ant-design/icons'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'


export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  async function handleGoogleLogin() {
    setGoogleLoading(true)
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/auth/callback` },
    })
  }

  async function onFinish(values: { email: string; password: string }) {
    setLoading(true)
    setError(null)
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    })
    setLoading(false)

    if (authError) {
      setError(authError.message)
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <Card style={{ width: 380 }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <img src="/homie_logo.png" alt="Homie" style={{ height: 60 }} />
      </div>

      {error && <Alert type="error" title={error} style={{ marginBottom: 16 }} showIcon />}
      <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
        <Form.Item name="email" rules={[{ required: true, type: 'email' }]}>
          <Input prefix={<MailOutlined />} placeholder="Email" size="large" />
        </Form.Item>
        <Form.Item name="password" rules={[{ required: true }]}>
          <Input.Password prefix={<LockOutlined />} placeholder="Password" size="large" />
        </Form.Item>
        <Form.Item style={{ marginBottom: 8 }}>
          <Button type="primary" htmlType="submit" block size="large" loading={loading}>
            Sign In
          </Button>
        </Form.Item>
      </Form>

      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <Link href="/forgot-password" style={{ fontSize: 13, color: 'rgba(0,0,0,0.45)' }}>
          Forgot password?
        </Link>
      </div>

      <Divider plain style={{ margin: '12px 0' }} />
      <Button
        block
        size="large"
        loading={googleLoading}
        onClick={handleGoogleLogin}
        icon={
          <svg width="18" height="18" viewBox="0 0 18 18" style={{ verticalAlign: 'middle' }}>
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
            <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/>
          </svg>
        }
        style={{ marginBottom: 12 }}
      >
        Continue with Google
      </Button>

      <Divider plain>New here?</Divider>
      <Link href="/signup">
        <Button block type="primary" ghost>Create account</Button>
      </Link>
    </Card>
  )
}
