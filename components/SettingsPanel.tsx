'use client'

import { useState } from 'react'
import {
  App, Card, Form, Input, Button, Typography, Divider, Tag, Space, Select, Modal
} from 'antd'
import { CopyOutlined, PlusOutlined, CheckOutlined, LogoutOutlined } from '@ant-design/icons'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  createHouseholdAction,
  joinHouseholdAction,
  updateDisplayNameAction,
  updateHouseholdCurrencyAction,
  updateAvatarAction,
} from '@/app/actions'

const AVATAR_COLORS = [
  '#FF6B6B', '#FF9F43', '#FECA57', '#48DBFB',
  '#1DD1A1', '#4361EE', '#A29BFE', '#FD79A8',
  '#636E72', '#2D3436',
]

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  const chars = (s: string) => Array.from(s)
  if (parts.length === 1) return chars(parts[0]).slice(0, 2).join('').toUpperCase()
  return (chars(parts[0])[0] + chars(parts[1])[0]).toUpperCase()
}

const { Text } = Typography

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

export default function SettingsPanel({ profile, members }: Props) {
  const { message } = App.useApp()
  const router = useRouter()
  const [nameLoading, setNameLoading] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)
  const [joinLoading, setJoinLoading] = useState(false)
  const [currencyLoading, setCurrencyLoading] = useState(false)
  const [colorPickerOpen, setColorPickerOpen] = useState(false)
  const [avatarColor, setAvatarColor] = useState<string>(profile?.avatar_color ?? AVATAR_COLORS[0])
  const [avatarInitials, setAvatarInitials] = useState<string>(profile?.avatar_initials ?? '')
  const [draftColor, setDraftColor] = useState<string>(profile?.avatar_color ?? AVATAR_COLORS[0])
  const [draftInitials, setDraftInitials] = useState<string>(profile?.avatar_initials ?? '')
  const [avatarSaving, setAvatarSaving] = useState(false)
  const supabase = createClient()
  const [nameForm] = Form.useForm()
  const [createForm] = Form.useForm()
  const [joinForm] = Form.useForm()

  if (!profile) {
    return (
      <Card title="Setting up your profile...">
        <Text type="secondary">
          Please refresh the page. If this persists, contact support.
        </Text>
      </Card>
    )
  }

  const household = profile?.household

  async function updateName(values: { display_name: string }) {
    setNameLoading(true)
    const result = await updateDisplayNameAction(values.display_name)
    setNameLoading(false)
    if (result.error) { message.error(result.error); return }
    message.success('Name updated')
    router.refresh()
  }

  function openAvatarModal() {
    setDraftColor(avatarColor)
    setDraftInitials(avatarInitials)
    setColorPickerOpen(true)
  }

  async function saveAvatar() {
    setAvatarSaving(true)
    const result = await updateAvatarAction(draftColor, draftInitials)
    setAvatarSaving(false)
    if (result.error) { message.error(result.error); return }
    setAvatarColor(draftColor)
    setAvatarInitials(draftInitials)
    setColorPickerOpen(false)
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

  function copyInviteCode() {
    if (household?.invite_code) {
      navigator.clipboard.writeText(household.invite_code)
      message.success('Invite code copied!')
    }
  }

  return (
    <Space orientation="vertical" style={{ width: '100%' }} size={16}>
      {/* Profile */}
      <Card title="Your Profile">
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', gap: 20 }}>
          {/* Avatar */}
          <div
            onClick={openAvatarModal}
            style={{
              width: 72, height: 72, borderRadius: '50%',
              background: avatarColor,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', userSelect: 'none',
              fontSize: 22, fontWeight: 600, color: '#fff',
              letterSpacing: 1,
            }}
          >
            {avatarInitials || getInitials(profile.display_name)}
          </div>

          {/* Name */}
          <Form
            form={nameForm}
            layout="vertical"
            initialValues={{ display_name: profile?.display_name }}
            onFinish={updateName}
            style={{ width: '100%', maxWidth: 320 }}
          >
            <Form.Item name="display_name" label="Name" rules={[{ required: true }]} style={{ marginBottom: 8 }}>
              <Input placeholder="Display name" />
            </Form.Item>
            <Form.Item style={{ marginBottom: 0 }}>
              <Button type="primary" htmlType="submit" loading={nameLoading}>Update</Button>
            </Form.Item>
          </Form>
        </div>

        {/* Avatar editor modal */}
        <Modal
          open={colorPickerOpen}
          onCancel={() => setColorPickerOpen(false)}
          onOk={saveAvatar}
          okText="Save"
          okButtonProps={{ loading: avatarSaving }}
          title="Edit avatar"
          centered
          width={300}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '8px 0' }}>
            {/* Live preview */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: draftColor,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20, fontWeight: 600, color: '#fff', letterSpacing: 1,
              }}>
                {draftInitials || getInitials(profile.display_name)}
              </div>
            </div>

            {/* Initials input */}
            <div>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>Text (max 2 characters)</Text>
              <Input
                value={draftInitials}
                placeholder={getInitials(profile.display_name)}
                maxLength={2}
                onChange={e => setDraftInitials(Array.from(e.target.value).slice(0, 2).join(''))}
                style={{ width: '100%' }}
              />
            </div>

            {/* Colour picker */}
            <div>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 10 }}>Colour</Text>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {AVATAR_COLORS.map(color => (
                  <div
                    key={color}
                    onClick={() => setDraftColor(color)}
                    style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: color, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      outline: draftColor === color ? `3px solid ${color}` : 'none',
                      outlineOffset: 2,
                    }}
                  >
                    {draftColor === color && <CheckOutlined style={{ color: '#fff', fontSize: 13 }} />}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      </Card>

      {/* Household */}
      {household ? (
        <Card title={`Household: ${household.name}`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Invite code */}
            <div>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>Invite code</Text>
              <div
                onClick={copyInviteCode}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  background: '#f5f5f5', border: '1px solid #e8e8e8',
                  borderRadius: 8, padding: '8px 14px',
                  cursor: 'pointer', userSelect: 'none',
                }}
              >
                <Text strong style={{ fontSize: 15, letterSpacing: 2, fontFamily: 'monospace' }}>
                  {household.invite_code}
                </Text>
                <CopyOutlined style={{ color: '#8c8c8c', fontSize: 13 }} />
              </div>
            </div>

            {/* Currency */}
            <div>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>Default currency</Text>
              <Select
                defaultValue={household.default_currency ?? 'USD'}
                options={CURRENCIES}
                style={{ width: 240 }}
                loading={currencyLoading}
                onChange={updateCurrency}
              />
            </div>

            {/* Members */}
            <div>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>Members</Text>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {members.map(m => (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: m.id === profile.id ? avatarColor : '#d9d9d9',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 600, color: '#fff', flexShrink: 0,
                    }}>
                      {m.id === profile.id ? (avatarInitials || getInitials(m.display_name)) : getInitials(m.display_name)}
                    </div>
                    <Text>{m.display_name}</Text>
                    {m.id === profile.id && <Tag style={{ margin: 0 }}>You</Tag>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      ) : (
        <Card title="Household">
          <Space orientation="vertical" style={{ width: '100%' }} size={16}>
            <div>
              <Text strong>Create a new household</Text>
              <Form form={createForm} layout="inline" onFinish={createHousehold} style={{ marginTop: 8 }}>
                <Form.Item name="name" rules={[{ required: true }]}>
                  <Input placeholder="Household name" />
                </Form.Item>
                <Form.Item>
                  <Button type="primary" htmlType="submit" icon={<PlusOutlined />} loading={createLoading}>
                    Create
                  </Button>
                </Form.Item>
              </Form>
            </div>

            <Divider plain>or</Divider>

            <div>
              <Text strong>Join with invite code</Text>
              <Form form={joinForm} layout="inline" onFinish={joinHousehold} style={{ marginTop: 8 }}>
                <Form.Item name="invite_code" rules={[{ required: true }]}>
                  <Input placeholder="Enter invite code" />
                </Form.Item>
                <Form.Item>
                  <Button htmlType="submit" loading={joinLoading}>Join</Button>
                </Form.Item>
              </Form>
            </div>
          </Space>
        </Card>
      )}

      <Button
        danger
        icon={<LogoutOutlined />}
        block
        onClick={async () => {
          await supabase.auth.signOut()
          router.push('/login')
          router.refresh()
        }}
      >
        Sign Out
      </Button>
    </Space>
  )
}
