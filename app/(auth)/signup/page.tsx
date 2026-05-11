'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { Button, Card, Form, Input, Typography, message, Alert } from 'antd'
import { MailOutlined, LockOutlined, UserOutlined } from '@ant-design/icons'
import Link from 'next/link'
import { signUpAction } from '@/app/actions'

const { Title, Text } = Typography

export default function SignupPage() {
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function onFinish(values: { display_name: string; email: string; password: string }) {
    setLoading(true)
    const result = await signUpAction(values.email, values.password, values.display_name)
    setLoading(false)

    if (result.error) {
      message.error(result.error)
      return
    }
    setDone(true)
  }

  if (done) {
    return (
      <Card style={{ width: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <Title level={2} style={{ margin: 0 }}>🏠 Homie</Title>
        </div>
        <Alert
          type="success"
          title="Check your email!"
          description="We sent a confirmation link. Click it, then sign in — you'll be prompted to set up your household."
          showIcon
        />
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Link href="/login">
            <Button type="primary">Go to Sign In</Button>
          </Link>
        </div>
      </Card>
    )
  }

  return (
    <Card style={{ width: 380 }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>🏠 Homie</Title>
        <Text type="secondary">Create your account</Text>
      </div>

      <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
        <Form.Item name="display_name" label="Your name" rules={[{ required: true }]}>
          <Input prefix={<UserOutlined />} placeholder="How your housemates see you" size="large" />
        </Form.Item>
        <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
          <Input prefix={<MailOutlined />} placeholder="Email" size="large" />
        </Form.Item>
        <Form.Item name="password" label="Password" rules={[{ required: true, min: 6 }]}>
          <Input.Password prefix={<LockOutlined />} placeholder="Min. 6 characters" size="large" />
        </Form.Item>
        <Button type="primary" htmlType="submit" block size="large" loading={loading}>
          Create Account
        </Button>
      </Form>

      <div style={{ textAlign: 'center', marginTop: 16 }}>
        <Link href="/login"><Button type="link">Already have an account? Sign in</Button></Link>
      </div>
    </Card>
  )
}
