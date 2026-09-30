'use client'

import { useState } from 'react'
import {
  App, Card, Form, Input, Button, Typography, Divider, Tag, Select
} from 'antd'
import { CopyOutlined, PlusOutlined, UserDeleteOutlined } from '@ant-design/icons'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  createHouseholdAction,
  joinHouseholdAction,
  updateDisplayNameAction,
  updateHouseholdCurrencyAction,
  removeMemberAction,
  deleteAccountAction,
} from '@/app/actions'

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  const chars = (s: string) => Array.from(s)
  if (parts.length === 1) return chars(parts[0]).slice(0, 2).join('').toUpperCase()
  return (chars(parts[0])[0] + chars(parts[1])[0]).toUpperCase()
}

const { Text, Title } = Typography

const CURRENCIES = [
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'TWD', label: 'TWD — Taiwan Dollar' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'GBP', label: 'GBP — British Pound' },
  { value: 'JPY', label: 'JPY — Japanese Yen' },
  { value: 'AUD', label: 'AUD — Australian Dollar' },
  { value: 'CAD', label: 'CAD — Canadian Dollar' },
  { value: 'HKD', label: 'HKD — Hong Kong Dollar' },
  { value: 'SGD', label: 'SGD — Singapore Dollar' },
]

type Props = {
  profile: any
  members: { id: string; display_name: string }[]
}

const sectionLabel = (text: string) => (
  <Text style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', color: '#8c8c8c', display: 'block', marginBottom: 12 }}>
    {text}
  </Text>
)

const row = (label: string, control: React.ReactNode) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 36, gap: 16 }}>
    <Text style={{ fontSize: 14, color: '#262626', flexShrink: 0 }}>{label}</Text>
    {control}
  </div>
)

export default function SettingsPanel({ profile, members }: Props) {
  const { message, modal } = App.useApp()
  const router = useRouter()
  const [nameLoading, setNameLoading] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)
  const [joinLoading, setJoinLoading] = useState(false)
  const [currencyLoading, setCurrencyLoading] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [avatarColor] = useState<string>(profile?.avatar_color ?? '#d9d9d9')
  const [avatarInitials] = useState<string>(profile?.avatar_initials ?? '')
  const supabase = createClient()
  const [nameForm] = Form.useForm()
  const [createForm] = Form.useForm()
  const [joinForm] = Form.useForm()

  if (!profile) return null

  const household = profile?.household

  async function updateName(values: { display_name: string }) {
    setNameLoading(true)
    const result = await updateDisplayNameAction(values.display_name)
    setNameLoading(false)
    if (result.error) { message.error(result.error); return }
    message.success('Name updated')
    router.refresh()
  }

  async function createHousehold(values: { name: string }) {
    setCreateLoading(true)
    const result = await createHouseholdAction(values.name)
    setCreateLoading(false)
    if (result.error) { message.error(result.error); return }
    message.success(`Created "${values.name}"`)
    router.push('/settings')
  }

  async function joinHousehold(values: { invite_code: string }) {
    setJoinLoading(true)
    const result = await joinHouseholdAction(values.invite_code)
    setJoinLoading(false)
    if (result.error) { message.error(result.error); return }
    message.success(`Joined "${result.data?.name}"`)
    router.refresh()
  }

  async function updateCurrency(currency: string) {
    if (!household?.id) return
    setCurrencyLoading(true)
    const result = await updateHouseholdCurrencyAction(household.id, currency)
    setCurrencyLoading(false)
    if (result.error) { message.error(result.error); return }
    message.success('Default currency updated')
  }

  async function removeMember(memberId: string, name: string) {
    modal.confirm({
      title: `Remove ${name}?`,
      content: 'They will be removed from the household and need a new invite to rejoin.',
      okText: 'Remove',
      okButtonProps: { danger: true },
      onOk: async () => {
        setRemovingId(memberId)
        const result = await removeMemberAction(memberId)
        setRemovingId(null)
        if (result.error) { message.error(result.error); return }
        message.success(`${name} removed`)
        router.refresh()
      },
    })
  }

  function copyInviteCode() {
    if (household?.invite_code) {
      navigator.clipboard.writeText(household.invite_code)
      message.success('Copied!')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

      {/* Profile */}
      <Card variant="borderless">
        {sectionLabel('Profile')}
        <Form
          form={nameForm}
          layout="inline"
          initialValues={{ display_name: profile?.display_name }}
          onFinish={updateName}
          style={{ gap: 8 }}
        >
          <Form.Item name="display_name" rules={[{ required: true }]} style={{ flex: 1, marginBottom: 0 }}>
            <Input placeholder="Display name" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button htmlType="submit" loading={nameLoading}>Save</Button>
          </Form.Item>
        </Form>
      </Card>

      {/* Household */}
      {household ? (
        <Card variant="borderless">
          {sectionLabel('Household')}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {row('Name', <Text strong>{household.name}</Text>)}

            {row('Invite code',
              <div
                onClick={copyInviteCode}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: '#f5f5f5', borderRadius: 6,
                  padding: '4px 10px', cursor: 'pointer',
                }}
              >
                <Text style={{ fontFamily: 'monospace', fontSize: 13, letterSpacing: 1 }}>
                  {household.invite_code}
                </Text>
                <CopyOutlined style={{ fontSize: 11, color: '#8c8c8c' }} />
              </div>
            )}

            {row('Default currency',
              <Select
                defaultValue={household.default_currency ?? 'USD'}
                options={CURRENCIES}
                style={{ width: 180 }}
                loading={currencyLoading}
                onChange={updateCurrency}
                variant="filled"
              />
            )}
          </div>

          <Divider style={{ margin: '16px 0' }} />

          {sectionLabel('Members')}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {members.map(m => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
                <div style={{
                  width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                  background: m.id === profile.id ? avatarColor : '#d9d9d9',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 600, color: '#fff',
                }}>
                  {m.id === profile.id ? (avatarInitials || getInitials(m.display_name)) : getInitials(m.display_name)}
                </div>
                <Text style={{ flex: 1, fontSize: 14 }}>{m.display_name}</Text>
                {m.id === profile.id
                  ? <Tag style={{ margin: 0 }}>You</Tag>
                  : (
                    <Button
                      type="text" size="small" danger
                      icon={<UserDeleteOutlined />}
                      loading={removingId === m.id}
                      onClick={() => removeMember(m.id, m.display_name)}
                    />
                  )
                }
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <Card variant="borderless">
          {sectionLabel('Household')}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <Text style={{ display: 'block', marginBottom: 8 }}>Create a new household</Text>
              <Form form={createForm} layout="inline" onFinish={createHousehold}>
                <Form.Item name="name" rules={[{ required: true }]} style={{ flex: 1, marginBottom: 0 }}>
                  <Input placeholder="Household name" />
                </Form.Item>
                <Form.Item style={{ marginBottom: 0 }}>
                  <Button type="primary" htmlType="submit" icon={<PlusOutlined />} loading={createLoading}>Create</Button>
                </Form.Item>
              </Form>
            </div>

            <Divider plain style={{ margin: 0 }}>or</Divider>

            <div>
              <Text style={{ display: 'block', marginBottom: 8 }}>Join with invite code</Text>
              <Form form={joinForm} layout="inline" onFinish={joinHousehold}>
                <Form.Item name="invite_code" rules={[{ required: true }]} style={{ flex: 1, marginBottom: 0 }}>
                  <Input placeholder="Enter invite code" />
                </Form.Item>
                <Form.Item style={{ marginBottom: 0 }}>
                  <Button htmlType="submit" loading={joinLoading}>Join</Button>
                </Form.Item>
              </Form>
            </div>
          </div>
        </Card>
      )}

      {/* Account actions */}
      <Card variant="borderless">
        {sectionLabel('Account')}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Button
            type="text"
            danger
            style={{ justifyContent: 'flex-start', paddingLeft: 4 }}
            onClick={() => modal.confirm({
              title: 'Delete account?',
              content: 'This will permanently delete your account and all your data. This cannot be undone.',
              okText: 'Delete account',
              okButtonProps: { danger: true },
              onOk: async () => {
                const result = await deleteAccountAction()
                if (result.error) { message.error(result.error); return }
                router.push('/login')
              },
            })}
          >
            Delete account
          </Button>
        </div>
      </Card>

    </div>
  )
}
