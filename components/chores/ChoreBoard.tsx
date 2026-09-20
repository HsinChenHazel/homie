'use client'

import { useState } from 'react'
import {
  App, Button, Card, Modal, Form, Input, Select, Popconfirm,
  Typography, Divider, Row, Col, Tabs
} from 'antd'
import {
  PlusOutlined, DeleteOutlined, CheckOutlined, SettingOutlined, LeftOutlined, RightOutlined
} from '@ant-design/icons'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  saveRotationAction,
  saveChoreSlotIndexesAction,
  markChoreCompleteAction,
  undoChoreCompleteAction,
} from '@/app/actions'
import { getMonthlyAssignments, getWeekStart, getWeeksInMonth } from '@/lib/chores'
import type { RotationSlot, ChoreWithSlot } from '@/lib/chores'
import type { Profile } from '@/lib/types'

const { Text } = Typography

type Completion = { chore_id: string; user_id: string; week_of: string }

type Props = {
  chores: ChoreWithSlot[]
  rotationSlots: RotationSlot[]
  completions: Completion[]
  members: Pick<Profile, 'id' | 'display_name'>[]
  currentUserId: string
  householdId: string | null
  household: { id: string; rotation_start_year: number; rotation_start_month: number } | null
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const MONTH_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAY_LABELS = ['M','T','W','T','F','S','S']

function getWeekDays(weekStart: string) {
  const [y, m, d] = weekStart.split('-').map(Number)
  const base = new Date(y, m - 1, d)
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(base)
    day.setDate(day.getDate() + i)
    return { year: day.getFullYear(), month: day.getMonth() + 1, day: day.getDate() }
  })
}

export default function ChoreBoard({
  chores, rotationSlots, completions: initCompletions, members, currentUserId, householdId, household
}: Props) {
  const { message } = App.useApp()
  const router = useRouter()
  const supabase = createClient()

  const [addChoreOpen, setAddChoreOpen] = useState(false)
  const [rotationOpen, setRotationOpen] = useState(false)
  const [choreForm] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [loadingWeek, setLoadingWeek] = useState<string | null>(null)

  const now = new Date()
  const thisYear = now.getFullYear()
  const thisMonth = now.getMonth() + 1
  const today = now.getDate()
  const currentWeekOf = getWeekStart()

  const [calYear, setCalYear] = useState(thisYear)
  const [calMonth, setCalMonth] = useState(thisMonth)
  const [calCompletions, setCalCompletions] = useState<Completion[]>(initCompletions)

  const startYear = household?.rotation_start_year ?? thisYear
  const startMonth = household?.rotation_start_month ?? thisMonth
  const isRotationConfigured = rotationSlots.length > 0 && chores.length > 0

  const monthAssignments = getMonthlyAssignments(chores, rotationSlots, startYear, startMonth, calYear, calMonth)
  const myAssignments = monthAssignments.filter(a => a.userId === currentUserId)

  function isDone(choreId: string, weekOf: string) {
    return calCompletions.some(c => c.chore_id === choreId && c.user_id === currentUserId && c.week_of === weekOf)
  }

  function weekStatus(weekOf: string): 'done' | 'partial' | 'none' {
    if (!myAssignments.length) return 'none'
    const doneCount = myAssignments.filter(a => isDone(a.chore.id, weekOf)).length
    if (doneCount === myAssignments.length) return 'done'
    if (doneCount > 0) return 'partial'
    return 'none'
  }

  async function fetchCompletions(year: number, month: number) {
    if (!householdId || !chores.length) return
    const weeks = getWeeksInMonth(year, month)
    const { data } = await supabase
      .from('chore_completions')
      .select('chore_id, user_id, week_of')
      .in('week_of', weeks)
      .in('chore_id', chores.map(c => c.id))
    setCalCompletions(data ?? [])
  }

  async function gotoMonth(year: number, month: number) {
    setCalYear(year)
    setCalMonth(month)
    await fetchCompletions(year, month)
  }

  function prevMonth() {
    gotoMonth(calMonth === 1 ? calYear - 1 : calYear, calMonth === 1 ? 12 : calMonth - 1)
  }
  function nextMonth() {
    gotoMonth(calMonth === 12 ? calYear + 1 : calYear, calMonth === 12 ? 1 : calMonth + 1)
  }

  async function markWeekDone(weekOf: string) {
    setLoadingWeek(weekOf)
    for (const a of myAssignments) {
      if (!isDone(a.chore.id, weekOf)) {
        const res = await markChoreCompleteAction(a.chore.id, weekOf)
        if (res.error) message.error(res.error)
      }
    }
    await fetchCompletions(calYear, calMonth)
    setLoadingWeek(null)
  }

  async function undoWeekDone(weekOf: string) {
    setLoadingWeek(weekOf)
    for (const a of myAssignments) {
      if (isDone(a.chore.id, weekOf)) {
        const res = await undoChoreCompleteAction(a.chore.id, weekOf)
        if (res.error) message.error(res.error)
      }
    }
    await fetchCompletions(calYear, calMonth)
    setLoadingWeek(null)
  }

  async function addChore(values: any) {
    if (!householdId) return
    setLoading(true)
    const { error } = await supabase.from('chores').insert({
      household_id: householdId,
      title: values.title,
      recurrence: 'weekly',
      slot_index: chores.length,
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
    await saveChoreSlotIndexesAction(chores.map((c, i) => ({ id: c.id, slot_index: i })))
    const result = await saveRotationAction(householdId, values.member_order, values.start_year, values.start_month)
    setLoading(false)
    if (result.error) { message.error(result.error); return }
    message.success('Rotation saved')
    setRotationOpen(false)
    router.refresh()
  }

  const weeks = getWeeksInMonth(calYear, calMonth)

  const calendarContent = !isRotationConfigured ? (
    <div style={{ textAlign: 'center', padding: '24px 0' }}>
      <Text type="secondary">Set up the rotation in the Manage tab to get started.</Text>
    </div>
  ) : (
    <div>
      {/* Month navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <Button icon={<LeftOutlined />} type="text" size="small" onClick={prevMonth} />
        <Text strong style={{ fontSize: 15 }}>{MONTH_FULL[calMonth - 1]} {calYear}</Text>
        <Button icon={<RightOutlined />} type="text" size="small" onClick={nextMonth} />
      </div>

      {/* Day-of-week headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
        {DAY_LABELS.map((d, i) => (
          <Text key={i} type="secondary" style={{ fontSize: 11, textAlign: 'center', display: 'block' }}>{d}</Text>
        ))}
      </div>

      {/* Week rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {weeks.map(weekStart => {
          const days = getWeekDays(weekStart)
          const status = weekStatus(weekStart)
          const isCurrentWeek = weekStart === currentWeekOf

          return (
            <div
              key={weekStart}
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                alignItems: 'center',
                borderRadius: 8,
                padding: '5px 2px',
                background: isCurrentWeek ? '#F0F4EE' : '#fafafa',
                border: `1px solid ${isCurrentWeek ? '#C8D8C4' : '#f0f0f0'}`,
              }}
            >
              {days.map((day, i) => {
                const isToday = day.year === thisYear && day.month === thisMonth && day.day === today
                const isOutside = day.month !== calMonth
                return (
                  <div key={i} style={{ textAlign: 'center' }}>
                    <span style={{
                      fontSize: 13,
                      color: isOutside ? '#d9d9d9' : isToday ? '#fff' : undefined,
                      fontWeight: isToday ? 600 : undefined,
                      background: isToday ? '#82957F' : undefined,
                      borderRadius: '50%',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 22,
                      height: 22,
                    }}>
                      {day.day}
                    </span>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* Month assignments */}
      <Divider plain style={{ margin: '16px 0 10px' }} />
      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
        {MONTHS[calMonth - 1]} {calYear} assignments
      </Text>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {monthAssignments.map(({ chore, userId, displayName }) => {
          const isMe = userId === currentUserId
          const isCurrentMonth = calYear === thisYear && calMonth === thisMonth
          const done = isMe && isDone(chore.id, currentWeekOf)
          const isLoading = loadingWeek === currentWeekOf
          return (
            <div key={chore.id} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 12px',
              borderRadius: 6,
              background: isMe && !done ? '#F0F4EE' : '#fafafa',
              border: `1px solid ${isMe && !done ? '#C8D8C4' : '#f0f0f0'}`,
            }}>
              <div>
                <Text style={{ fontSize: 13, textDecoration: done ? 'line-through' : undefined, color: done ? '#bfbfbf' : undefined }}>{chore.title}</Text>
                <Text type="secondary" style={{ fontSize: 12, marginLeft: 8, color: done ? '#d9d9d9' : undefined }}>
                  {isMe ? 'You' : displayName}
                </Text>
              </div>
              {isMe && isCurrentMonth && (
                done ? (
                  <Button
                    size="small"
                    type="text"
                    style={{ fontSize: 11, color: '#bfbfbf' }}
                    loading={isLoading}
                    onClick={() => undoChoreCompleteAction(chore.id, currentWeekOf).then(() => fetchCompletions(calYear, calMonth))}
                  >
                    Undo
                  </Button>
                ) : (
                  <Button
                    size="small"
                    type="primary"
                    style={{ fontSize: 11 }}
                    loading={isLoading}
                    onClick={() => markChoreCompleteAction(chore.id, currentWeekOf).then(() => fetchCompletions(calYear, calMonth))}
                  >
                    Mark Done
                  </Button>
                )
              )}
            </div>
          )
        })}
      </div>
    </div>
  )

  const manageContent = (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text strong>Chores</Text>
        <Button size="small" icon={<PlusOutlined />} onClick={() => setAddChoreOpen(true)}>Add</Button>
      </div>

      {chores.length === 0 ? (
        <Text type="secondary">No chores yet.</Text>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
          {[...chores].sort((a, b) => a.slot_index - b.slot_index).map(c => (
            <div key={c.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 12px', borderRadius: 6, border: '1px solid #f0f0f0',
            }}>
              <Text>{c.title}</Text>
              <Popconfirm title="Delete this chore?" onConfirm={() => deleteChore(c.id)}>
                <Button icon={<DeleteOutlined />} type="text" danger size="small" />
              </Popconfirm>
            </div>
          ))}
        </div>
      )}

      <Divider plain />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text strong>Rotation</Text>
        <Button size="small" icon={<SettingOutlined />} onClick={() => setRotationOpen(true)}>
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
              <Text>{s.profile?.display_name ?? '—'}</Text>
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
          defaultActiveKey="calendar"
          items={[
            { key: 'calendar', label: 'Roster', children: calendarContent },
            { key: 'manage', label: 'Manage', children: manageContent },
          ]}
        />
      </Card>

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
            help="Person 1 does Chore 1 in the start month."
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
                <Select options={[thisYear - 1, thisYear, thisYear + 1].map(y => ({ value: y, label: `${y}` }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="start_month" label="Start month" rules={[{ required: true }]}>
                <Select options={MONTHS.map((m, i) => ({ value: i + 1, label: m }))} />
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
