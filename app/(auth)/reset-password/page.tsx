'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { Button, Card, Form, Input, Alert } from 'antd'
import { LockOutlined } from '@ant-design/icons'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  async function onFinish(values: { password: string }) {
    setLoading(true)
    setError(null)
    const { error: authError } = await supabase.auth.updateUser({ password: values.password })
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
        <Form.Item
          name="password"
          rules={[{ required: true, min: 6, message: 'Password must be at least 6 characters' }]}
        >
          <Input.Password prefix={<LockOutlined />} placeholder="New password" size="large" />
        </Form.Item>
        <Form.Item
          name="confirm"
          dependencies={['password']}
          rules={[
            { required: true },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('password') === value) return Promise.resolve()
                return Promise.reject(new Error('Passwords do not match'))
              },
            }),
          ]}
        >
          <Input.Password prefix={<LockOutlined />} placeholder="Confirm new password" size="large" />
        </Form.Item>
        <Form.Item style={{ marginBottom: 0 }}>
          <Button type="primary" htmlType="submit" block size="large" loading={loading}>
            Reset password
          </Button>
        </Form.Item>
      </Form>
    </Card>
  )
}
