'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { Button, Card, Form, Input, Typography, Alert } from 'antd'
import { MailOutlined } from '@ant-design/icons'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const { Text } = Typography

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const supabase = createClient()

  async function onFinish(values: { email: string }) {
    setLoading(true)
    setError(null)
    const { error: authError } = await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo: `${window.location.origin}/auth/confirm?next=/reset-password`,
    })
    setLoading(false)

    if (authError) {
      setError(authError.message)
      return
    }
    setSent(true)
  }

  return (
    <Card style={{ width: 380 }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <img src="/homie_logo.png" alt="Homie" style={{ height: 60 }} />
      </div>

      {error && <Alert type="error" title={error} style={{ marginBottom: 16 }} showIcon />}

      {sent ? (
        <Alert
          type="success"
          title="Check your email for a password reset link."
          style={{ marginBottom: 16 }}
          showIcon
        />
      ) : (
        <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
          <Form.Item name="email" rules={[{ required: true, type: 'email' }]}>
            <Input prefix={<MailOutlined />} placeholder="Email" size="large" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 8 }}>
            <Button type="primary" htmlType="submit" block size="large" loading={loading}>
              Send reset link
            </Button>
          </Form.Item>
        </Form>
      )}

      <div style={{ textAlign: 'center', marginTop: 8 }}>
        <Link href="/login">
          <Text type="secondary" style={{ fontSize: 13 }}>Back to sign in</Text>
        </Link>
      </div>
    </Card>
  )
}
