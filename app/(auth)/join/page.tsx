'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { App, Button, Card, Form, Input, Typography, Steps } from 'antd'
import { HomeOutlined, UserOutlined, MailOutlined, LockOutlined } from '@ant-design/icons'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { joinWithSignupAction } from '@/app/actions'

const { Title, Text } = Typography

export default function JoinPage() {
  const { message } = App.useApp()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(0)
  const [form] = Form.useForm()

  async function onFinish(values: {
    display_name: string
    email: string
    password: string
  }) {
    const inviteCode = (form.getFieldValue('invite_code') ?? '').trim()
    if (!inviteCode) {
      message.error('Invite code is missing')
      setStep(0)
      return
    }

    setLoading(true)
    const result = await joinWithSignupAction(inviteCode, values.email, values.password, values.display_name)
    setLoading(false)

    if (result.error) {
      message.error(result.error)
      if (result.error === 'Invalid invite code') setStep(0)
      return
    }

    message.success(`Joined "${result.data?.householdName}"! Check your email to confirm.`)
    router.push('/login')
  }

  return (
    <Card style={{ width: 420 }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>🏠 Homie</Title>
        <Text type="secondary">Join your household</Text>
      </div>

      <Steps
        current={step}
        size="small"
        style={{ marginBottom: 24 }}
        items={[{ title: 'Invite Code' }, { title: 'Your Details' }]}
      />

      <Form layout="vertical" form={form} onFinish={onFinish} requiredMark={false}>
        {/* Keep invite_code mounted but hidden so the value is preserved */}
        <Form.Item
          name="invite_code"
          label="Invite Code"
          rules={[{ required: true, message: 'Please enter an invite code' }]}
          style={{ display: step === 0 ? undefined : 'none' }}
        >
          <Input prefix={<HomeOutlined />} placeholder="e.g. abc12345" size="large" />
        </Form.Item>

        {step === 1 && (
          <>
            <Form.Item name="display_name" label="Your Name" rules={[{ required: true }]}>
              <Input prefix={<UserOutlined />} placeholder="How your housemates see you" size="large" />
            </Form.Item>
            <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
              <Input prefix={<MailOutlined />} placeholder="Email" size="large" />
            </Form.Item>
            <Form.Item name="password" label="Password" rules={[{ required: true, min: 6 }]}>
              <Input.Password prefix={<LockOutlined />} placeholder="Min. 6 characters" size="large" />
            </Form.Item>
          </>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          {step === 0 ? (
            <Button
              type="primary"
              block
              size="large"
              onClick={() => {
                form.validateFields(['invite_code']).then(() => setStep(1))
              }}
            >
              Next
            </Button>
          ) : (
            <>
              <Button block size="large" onClick={() => setStep(0)}>Back</Button>
              <Button type="primary" htmlType="submit" block size="large" loading={loading}>
                Join Household
              </Button>
            </>
          )}
        </div>
      </Form>

      <div style={{ textAlign: 'center', marginTop: 16 }}>
        <Link href="/login">
          <Button type="link">Already have an account? Sign in</Button>
        </Link>
      </div>
    </Card>
  )
}
