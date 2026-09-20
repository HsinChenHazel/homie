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
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

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
        <img src="/homie_logo.svg" alt="Homie" style={{ height: 60 }} />
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

      <Divider plain>New here?</Divider>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Link href="/signup">
          <Button block type="primary" ghost>Create account</Button>
        </Link>
        <Link href="/join">
          <Button block>Join with invite code</Button>
        </Link>
      </div>
    </Card>
  )
}
