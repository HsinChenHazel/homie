'use client'

import { useState } from 'react'
import {
  App, Button, Card, Modal, Form, Input, Select, Popconfirm,
  Typography, Divider, Row, Col, Tabs
} from 'antd'
import {
  PlusOutlined, DeleteOutlined, CheckOutlined, UndoOutlined, SettingOutlined
} from '@ant-design/icons'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  saveRotationAction,
  saveChoreSlotIndexesAction,
  markChoreCompleteAction,
  undoChoreCompleteAction,
} from '@/app/actions'
import { getMonthlyAssignments, getWeekStart } from '@/lib/chores'
import type { RotationSlot, ChoreWithSlot } from '@/lib/chores'
import type { Profile } from '@/lib/types'

const { Text, Title } = Typography

type Completion = {
  chore_id: string
  user_id: string
  week_of: string
}

type Props = {
  chores: ChoreWithSlot[]
  rotationSlots: RotationSlot[]
  completions: Completion[]
  members: Pick<Profile, 'id' | 'display_name'>[]
  currentUserId: string
  householdId: string | null
  household: { id: string; rotation_start_year: number; rotation_start_month: number } | null
}

const MONTHS = [
  'Jan','Feb','Mar','Apr','May','Jun',
  'Jul','Aug','Sep','Oct','Nov','Dec',
]

export default function ChoreBoard({
  chores, rotationSlots, completions, members, currentUserId, householdId, household
}: Props) {
  const { message } = App.useApp()
  const router = useRouter()
  const supabase = createClient()

  const [addChoreOpen, setAddChoreOpen] = useState(false)
  const [rotationOpen, setRotationOpen] = useState(false)
  const [choreForm] = Form.useForm()
  const [loading, setLoading] = useState(false)

  const now = new Date()
  const thisYear = now.getFullYear()
  const thisMonth = now.getMonth() + 1 // 1-based
  const weekOf = getWeekStart()

  const startYear = household?.rotation_start_year ?? thisYear
  const startMonth = household?.rotation_start_month ?? thisMonth

  const assignments = getMonthlyAssignments(
    chores, rotationSlots, startYear, startMonth, thisYear, thisMonth
  )

  const myAssignment = assignments.find(a => a.userId === currentUserId)
  const isRotationConfigured = rotationSlots.length > 0 && chores.length > 0

  function isDoneThisWeek(choreId: string, userId: string) {
    return completions.some(c => c.chore_id === choreId && c.user_id === userId && c.week_of === weekOf)
  }

  async function handleDone(choreId: string) {
    const result = await markChoreCompleteAction(choreId, weekOf)
    if (result.error) message.error(result.error)
    else router.refresh()
  }

  async function handleUndo(choreId: string) {
    const result = await undoChoreCompleteAction(choreId, weekOf)
    if (result.error) message.error(result.error)
    else router.refresh()
  }

  async function addChore(values: any) {
    if (!householdId) return
    setLoading(true)
    const nextSlot = chores.length
    const { error } = await supabase.from('chores').insert({
      household_id: householdId,
      title: values.title,
      recurrence: 'weekly',
      slot_index: nextSlot,
    })
    setLoading(false)
    if (error) { message.error(error.message); return }
    message.success('Chore added')
    setAddChoreOpen(false)
    choreForm.resetFields()
    router.refresh()
  }

  async function deleteChore(id: string) {
    await supabase.from('chores').delete().eq('id', id)
    router.refresh()
  }

  async function saveRotation(values: any) {
    if (!householdId) return
    setLoading(true)

    // Save rotation member order
    const memberOrder: string[] = values.member_order
    const startYearVal: number = values.start_year
    const startMonthVal: number = values.start_month

    // Save chore slot indexes from the drag order (use current chores order as-is)
    await saveChoreSlotIndexesAction(chores.map((c, i) => ({ id: c.id, slot_index: i })))
    const result = await saveRotationAction(householdId, memberOrder, startYearVal, startMonthVal)

    setLoading(false)
    if (result.error) { message.error(result.error); return }
    message.success('Rotation saved')
    setRotationOpen(false)
    router.refresh()
  }

  // ── This Week tab ────────────────────────────────────────────────
  const thisWeekContent = !isRotationConfigured ? (
    <div style={{ textAlign: 'center', padding: '24px 0' }}>
      <Text type="secondary">Set up the rotation in the Manage tab to get started.</Text>
    </div>
  ) : (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {assignments.map(({ chore, userId, displayName }) => {
        const isMe = userId === currentUserId
        const done = isDoneThisWeek(chore.id, userId)

        return (
          <div
            key={chore.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
              borderRadius: 8,
              background: done ? '#f6ffed' : isMe ? '#f0f4ff' : '#fafafa',
              border: `1px solid ${done ? '#b7eb8f' : isMe ? '#c7d2fe' : '#f0f0f0'}`,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Text
                strong
                style={{
                  fontSize: 14,
                  textDecoration: done ? 'line-through' : undefined,
                  color: done ? '#8c8c8c' : undefined,
                }}
              >
                {chore.title}
              </Text>
              <Text style={{ fontSize: 12, color: '#8c8c8c' }}>
                {isMe ? 'You' : displayName}
                {done ? ' · Done ✓' : ''}
              </Text>
            </div>

            {isMe && (
              done ? (
                <Button
                  size="small"
                  icon={<UndoOutlined />}
                  onClick={() => handleUndo(chore.id)}
                  style={{ fontSize: 11, height: 24, padding: '0 8px' }}
                >
                  Undo
                </Button>
              ) : (
                <Button
                  type="primary"
                  size="small"
                  icon={<CheckOutlined />}
                  onClick={() => handleDone(chore.id)}
                  style={{ fontSize: 11, height: 24, padding: '0 8px' }}
                >
                  Done
                </Button>
              )
            )}
          </div>
        )
      })}
    </div>
  )

  // ── This Month tab ───────────────────────────────────────────────
  const thisMonthContent = !isRotationConfigured ? (
    <Text type="secondary">Set up the rotation first.</Text>
  ) : (
    <div>
      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
        {MONTHS[thisMonth - 1]} {thisYear}
      </Text>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {assignments.map(({ chore, userId, displayName }) => (
          <div
            key={chore.id}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '10px 14px',
              borderRadius: 8,
              background: '#fafafa',
              border: '1px solid #f0f0f0',
            }}
          >
            <Text strong>{chore.title}</Text>
            <Text style={{ color: userId === currentUserId ? '#4361EE' : undefined }}>
              {userId === currentUserId ? 'You' : displayName}
            </Text>
          </div>
        ))}
      </div>
    </div>
  )

  // ── Manage tab ───────────────────────────────────────────────────
  const manageContent = (
    <div>
      {/* Chores list */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text strong>Chores</Text>
        <Button size="small" icon={<PlusOutlined />} onClick={() => setAddChoreOpen(true)}>
          Add
        </Button>
      </div>

      {chores.length === 0 ? (
        <Text type="secondary">No chores yet.</Text>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
          {[...chores].sort((a, b) => a.slot_index - b.slot_index).map(c => (
            <div
              key={c.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid #f0f0f0',
              }}
            >
              <Text>{c.title}</Text>
              <Popconfirm title="Delete this chore?" onConfirm={() => deleteChore(c.id)}>
                <Button icon={<DeleteOutlined />} type="text" danger size="small" />
              </Popconfirm>
            </div>
          ))}
        </div>
      )}

      <Divider plain />

      {/* Rotation setup */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text strong>Rotation</Text>
        <Button
          size="small"
          icon={<SettingOutlined />}
          onClick={() => {
            const currentOrder = [...rotationSlots]
              .sort((a, b) => a.slot_index - b.slot_index)
              .map(s => s.user_id)
            setRotationOpen(true)
          }}
        >
          {rotationSlots.length ? 'Edit' : 'Set up'}
        </Button>
      </div>

      {rotationSlots.length === 0 ? (
        <Text type="secondary">No rotation configured yet.</Text>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[...rotationSlots].sort((a, b) => a.slot_index - b.slot_index).map((s, i) => (
            <div key={s.user_id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Text type="secondary" style={{ width: 20, textAlign: 'right', fontSize: 12 }}>{i + 1}</Text>
              <Text>{s.profile.display_name}</Text>
            </div>
          ))}
          <Text type="secondary" style={{ fontSize: 12, marginTop: 4 }}>
            Starting {MONTHS[startMonth - 1]} {startYear}
          </Text>
        </div>
      )}
    </div>
  )

  return (
    <>
      <Card>
        <Tabs
          defaultActiveKey="week"
          items={[
            { key: 'week', label: 'This Week', children: thisWeekContent },
            { key: 'month', label: 'This Month', children: thisMonthContent },
            { key: 'manage', label: 'Manage', children: manageContent },
          ]}
        />
      </Card>

      {/* Add Chore Modal */}
      <Modal
        title="Add Chore"
        open={addChoreOpen}
        onCancel={() => { setAddChoreOpen(false); choreForm.resetFields() }}
        footer={null}
      >
        <Form form={choreForm} layout="vertical" onFinish={addChore} requiredMark={false}>
          <Form.Item name="title" label="Chore name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Kitchen, Bathroom, Vacuum, Trash" />
          </Form.Item>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => { setAddChoreOpen(false); choreForm.resetFields() }}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={loading}>Add</Button>
          </div>
        </Form>
      </Modal>

      {/* Rotation Modal */}
      <Modal
        title="Set Rotation Order"
        open={rotationOpen}
        onCancel={() => setRotationOpen(false)}
        footer={null}
      >
        <Form
          layout="vertical"
          onFinish={saveRotation}
          requiredMark={false}
          initialValues={{
            member_order: rotationSlots.length
              ? [...rotationSlots].sort((a, b) => a.slot_index - b.slot_index).map(s => s.user_id)
              : members.map(m => m.id),
            start_year: startYear,
            start_month: startMonth,
          }}
        >
          <Form.Item
            name="member_order"
            label="Member rotation order"
            help="Drag to reorder, or change the order here. Person 1 does Chore 1 in the start month."
            rules={[{ required: true }]}
          >
            <Select
              mode="multiple"
              options={members.map(m => ({ value: m.id, label: m.display_name }))}
              placeholder="Select members in rotation order"
            />
          </Form.Item>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="start_year" label="Start year" rules={[{ required: true }]}>
                <Select
                  options={[thisYear - 1, thisYear, thisYear + 1].map(y => ({ value: y, label: `${y}` }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="start_month" label="Start month" rules={[{ required: true }]}>
                <Select
                  options={MONTHS.map((m, i) => ({ value: i + 1, label: m }))}
                />
              </Form.Item>
            </Col>
          </Row>

          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 16 }}>
            The start month sets which person does which chore first. Each subsequent month rotates by one.
          </Text>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setRotationOpen(false)}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={loading}>Save</Button>
          </div>
        </Form>
      </Modal>
    </>
  )
}
