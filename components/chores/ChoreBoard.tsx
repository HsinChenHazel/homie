'use client'

import { useState } from 'react'
import {
  App, Button, Card, Modal, Form, Input, Select, Popconfirm,
  Typography, Divider, Row, Col, Tabs
} from 'antd'
import {
  PlusOutlined, DeleteOutlined, EditOutlined, LeftOutlined, RightOutlined
} from '@ant-design/icons'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  markChoreCompleteAction,
  undoChoreCompleteAction,
  saveRotationStartAction,
} from '@/app/actions'
import {
  getMonthlyAssignmentsV2,
  getWeekStart,
  getWeeksInMonth,
} from '@/lib/chores'
import type { ChoreWithAssignees } from '@/lib/chores'
import type { Profile } from '@/lib/types'

const { Text } = Typography

type Completion = { chore_id: string; user_id: string; week_of: string }

type Props = {
  chores: ChoreWithAssignees[]
  completions: Completion[]
  members: Pick<Profile, 'id' | 'display_name'>[]
  currentUserId: string
  householdId: string | null
  household: { id: string; rotation_start_year: number; rotation_start_month: number } | null
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const MONTH_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December']

export default function ChoreBoard({
  chores, completions: initCompletions, members, currentUserId, householdId, household
}: Props) {
  const { message } = App.useApp()
  const router = useRouter()
  const supabase = createClient()

  const now = new Date()
  const thisYear = now.getFullYear()
  const thisMonth = now.getMonth() + 1
  const currentWeekOf = getWeekStart()

  const [calYear, setCalYear] = useState(thisYear)
  const [calMonth, setCalMonth] = useState(thisMonth)
  const [calCompletions, setCalCompletions] = useState<Completion[]>(initCompletions)

  const [addChoreOpen, setAddChoreOpen] = useState(false)
  const [editChore, setEditChore] = useState<ChoreWithAssignees | null>(null)
  const [rotationStartOpen, setRotationStartOpen] = useState(false)
  const [choreForm] = Form.useForm()
  const [rotStartForm] = Form.useForm()
  const [loading, setLoading] = useState(false)

  const startYear = household?.rotation_start_year ?? thisYear
  const startMonth = household?.rotation_start_month ?? thisMonth

  const monthAssignments = getMonthlyAssignmentsV2(chores, startYear, startMonth, calYear, calMonth)

  function isDone(choreId: string, weekOf: string) {
    return calCompletions.some(c => c.chore_id === choreId && c.user_id === currentUserId && c.week_of === weekOf)
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

  function prevMonth() {
    const y = calMonth === 1 ? calYear - 1 : calYear
    const m = calMonth === 1 ? 12 : calMonth - 1
    setCalYear(y); setCalMonth(m)
    fetchCompletions(y, m)
  }
  function nextMonth() {
    const y = calMonth === 12 ? calYear + 1 : calYear
    const m = calMonth === 12 ? 1 : calMonth + 1
    setCalYear(y); setCalMonth(m)
    fetchCompletions(y, m)
  }

  async function addChore(values: { title: string; assignee_ids: string[] }) {
    if (!householdId) return
    setLoading(true)
    const { data: chore, error: choreErr } = await supabase
      .from('chores')
      .insert({ household_id: householdId, title: values.title, recurrence: 'weekly' })
      .select()
      .single()
    if (choreErr || !chore) { message.error(choreErr?.message ?? 'Failed to add chore'); setLoading(false); return }

    if (values.assignee_ids?.length) {
      await supabase.from('chore_assignees').insert(
        values.assignee_ids.map((uid, i) => ({ chore_id: chore.id, user_id: uid, slot_index: i }))
      )
    }
    setLoading(false)
    message.success('Chore added')
    setAddChoreOpen(false)
    choreForm.resetFields()
    router.refresh()
  }

  async function saveEditChore(values: { title: string; assignee_ids: string[] }) {
    if (!editChore) return
    setLoading(true)
    await supabase.from('chores').update({ title: values.title }).eq('id', editChore.id)
    await supabase.from('chore_assignees').delete().eq('chore_id', editChore.id)
    if (values.assignee_ids?.length) {
      await supabase.from('chore_assignees').insert(
        values.assignee_ids.map((uid, i) => ({ chore_id: editChore.id, user_id: uid, slot_index: i }))
      )
    }
    setLoading(false)
    message.success('Chore updated')
    setEditChore(null)
    choreForm.resetFields()
    router.refresh()
  }

  async function deleteChore(id: string) {
    await supabase.from('chores').delete().eq('id', id)
    router.refresh()
  }

  async function saveRotationStart(values: { start_year: number; start_month: number }) {
    if (!householdId) return
    setLoading(true)
    const result = await saveRotationStartAction(householdId, values.start_year, values.start_month)
    setLoading(false)
    if (result.error) { message.error(result.error); return }
    message.success('Rotation start saved')
    setRotationStartOpen(false)
    router.refresh()
  }

  function openEditChore(chore: ChoreWithAssignees) {
    setEditChore(chore)
    choreForm.setFieldsValue({
      title: chore.title,
      assignee_ids: [...chore.chore_assignees]
        .sort((a, b) => a.slot_index - b.slot_index)
        .map(a => a.user_id),
    })
  }

  // --- Roster tab ---
  const isCurrentMonth = calYear === thisYear && calMonth === thisMonth

  const assignmentsByPerson = new Map<string, { displayName: string; chores: typeof monthAssignments }>()
  for (const a of monthAssignments) {
    if (!assignmentsByPerson.has(a.userId)) {
      assignmentsByPerson.set(a.userId, { displayName: a.displayName, chores: [] })
    }
    assignmentsByPerson.get(a.userId)!.chores.push(a)
  }

  const rosterContent = (
    <div>
      {/* Month navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <Button icon={<LeftOutlined />} type="text" size="small" onClick={prevMonth} />
        <Text strong style={{ fontSize: 15 }}>{MONTH_FULL[calMonth - 1]} {calYear}</Text>
        <Button icon={<RightOutlined />} type="text" size="small" onClick={nextMonth} />
      </div>

      {chores.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <Text type="secondary">No chores set up yet. Add chores in the Manage tab.</Text>
        </div>
      ) : assignmentsByPerson.size === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <Text type="secondary">No assignees configured. Edit chores in the Manage tab to add rotation members.</Text>
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {Array.from(assignmentsByPerson.entries()).map(([userId, { displayName, chores: personChores }]) => {
            const isMe = userId === currentUserId
            return (
              <div key={userId} style={{
                flex: '1 1 160px',
                minWidth: 140,
                border: `1px solid ${isMe ? '#C8D8C4' : '#f0f0f0'}`,
                borderRadius: 10,
                overflow: 'hidden',
              }}>
                <div style={{
                  background: isMe ? '#F0F4EE' : '#fafafa',
                  padding: '8px 12px',
                  borderBottom: `1px solid ${isMe ? '#C8D8C4' : '#f0f0f0'}`,
                }}>
                  <Text strong style={{ fontSize: 13 }}>{isMe ? 'You' : displayName}</Text>
                </div>
                <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {personChores.map(a => {
                    const done = isDone(a.chore.id, currentWeekOf)
                    return (
                      <div key={a.chore.id}>
                        <Text style={{
                          fontSize: 13,
                          display: 'block',
                          textDecoration: done ? 'line-through' : undefined,
                          color: done ? '#bfbfbf' : undefined,
                        }}>
                          {a.chore.title}
                        </Text>
                        {isMe && isCurrentMonth && (
                          done ? (
                            <Button
                              size="small"
                              type="text"
                              style={{ fontSize: 11, color: '#bfbfbf', padding: 0, height: 'auto' }}
                              onClick={() => undoChoreCompleteAction(a.chore.id, currentWeekOf).then(() => fetchCompletions(calYear, calMonth))}
                            >
                              Undo
                            </Button>
                          ) : (
                            <Button
                              size="small"
                              type="primary"
                              style={{ fontSize: 11, marginTop: 4 }}
                              onClick={() => markChoreCompleteAction(a.chore.id, currentWeekOf).then(() => fetchCompletions(calYear, calMonth))}
                            >
                              Mark done
                            </Button>
                          )
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )

  // --- Manage tab ---
  const manageContent = (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text strong>Chores</Text>
        <Button size="small" icon={<PlusOutlined />} onClick={() => { choreForm.resetFields(); setAddChoreOpen(true) }}>Add</Button>
      </div>

      {chores.length === 0 ? (
        <Text type="secondary">No chores yet.</Text>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
          {chores.map(c => {
            const assignees = [...c.chore_assignees]
              .filter(a => a.profile !== null)
              .sort((a, b) => a.slot_index - b.slot_index)
            const assigneeLabel = assignees.length
              ? assignees.map(a => a.profile!.display_name).join(' → ')
              : 'No assignees'
            return (
              <div key={c.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 12px', borderRadius: 6, border: '1px solid #f0f0f0',
              }}>
                <div>
                  <Text style={{ fontSize: 13 }}>{c.title}</Text>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>{assigneeLabel}</Text>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <Button icon={<EditOutlined />} type="text" size="small" onClick={() => openEditChore(c)} />
                  <Popconfirm title="Delete this chore?" onConfirm={() => deleteChore(c.id)}>
                    <Button icon={<DeleteOutlined />} type="text" danger size="small" />
                  </Popconfirm>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Divider plain />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div>
          <Text strong>Rotation start</Text>
          <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
            {MONTHS[startMonth - 1]} {startYear}
          </Text>
        </div>
        <Button size="small" icon={<EditOutlined />} onClick={() => {
          rotStartForm.setFieldsValue({ start_year: startYear, start_month: startMonth })
          setRotationStartOpen(true)
        }}>Edit</Button>
      </div>
    </div>
  )

  return (
    <>
      <Card>
        <Tabs
          defaultActiveKey="roster"
          items={[
            { key: 'roster', label: 'Roster', children: rosterContent },
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
            <Input placeholder="e.g. Mopping, Vacuuming, Trash" />
          </Form.Item>
          <Form.Item name="assignee_ids" label="Who rotates (in order)">
            <Select
              mode="multiple"
              options={members.map(m => ({ value: m.id, label: m.display_name }))}
              placeholder="Select members in rotation order"
            />
          </Form.Item>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 16 }}>
            Select members in the rotation order.
          </Text>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => { setAddChoreOpen(false); choreForm.resetFields() }}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={loading}>Add</Button>
          </div>
        </Form>
      </Modal>

      {/* Edit Chore Modal */}
      <Modal
        title="Edit Chore"
        open={editChore !== null}
        onCancel={() => { setEditChore(null); choreForm.resetFields() }}
        footer={null}
      >
        <Form form={choreForm} layout="vertical" onFinish={saveEditChore} requiredMark={false}>
          <Form.Item name="title" label="Chore name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Mopping, Vacuuming, Trash" />
          </Form.Item>
          <Form.Item name="assignee_ids" label="Who rotates (in order)">
            <Select
              mode="multiple"
              options={members.map(m => ({ value: m.id, label: m.display_name }))}
              placeholder="Select members in rotation order"
            />
          </Form.Item>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 16 }}>
            Select members in the rotation order.
          </Text>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => { setEditChore(null); choreForm.resetFields() }}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={loading}>Save</Button>
          </div>
        </Form>
      </Modal>

      {/* Rotation Start Modal */}
      <Modal
        title="Rotation Start"
        open={rotationStartOpen}
        onCancel={() => setRotationStartOpen(false)}
        footer={null}
      >
        <Form form={rotStartForm} layout="vertical" onFinish={saveRotationStart} requiredMark={false}>
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
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setRotationStartOpen(false)}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={loading}>Save</Button>
          </div>
        </Form>
      </Modal>
    </>
  )
}
