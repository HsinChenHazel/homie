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
  createChoreGroupAction,
  updateChoreGroupAction,
  deleteChoreGroupAction,
} from '@/app/actions'
import { getAllGroupAssignments, getWeekStart, getWeeksInMonth } from '@/lib/chores'
import type { ChoreGroup } from '@/lib/chores'

const { Text } = Typography

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const MONTH_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December']

type Completion = { chore_id: string; user_id: string; week_of: string }

type Props = {
  groups: ChoreGroup[]
  allChores: { id: string; title: string; slot_index: number; group_id: string | null }[]
  completions: Completion[]
  members: { id: string; display_name: string; avatar_color?: string | null }[]
  currentUserId: string
  householdId: string | null
}

export default function ChoreBoard({
  groups: initGroups, allChores: initAllChores, completions: initCompletions,
  members, currentUserId, householdId
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

  // Group modal state
  const [groupModalOpen, setGroupModalOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<ChoreGroup | null>(null)
  const [groupForm] = Form.useForm()
  const [groupLoading, setGroupLoading] = useState(false)

  // New chore inline state (inside group modal)
  const [newChoreTitle, setNewChoreTitle] = useState('')
  const [newChoreLoading, setNewChoreLoading] = useState(false)
  // Local chores list for the modal (may grow as user adds new chores inline)
  const [modalChores, setModalChores] = useState(initAllChores)

  // Ungrouped chore add state
  const [addUngroupedOpen, setAddUngroupedOpen] = useState(false)
  const [ungroupedForm] = Form.useForm()
  const [ungroupedLoading, setUngroupedLoading] = useState(false)

  const isCurrentMonth = calYear === thisYear && calMonth === thisMonth

  async function fetchCompletions(year: number, month: number) {
    if (!householdId) return
    const choreIds = modalChores.map(c => c.id)
    if (!choreIds.length) return
    const weeks = getWeeksInMonth(year, month)
    const { data } = await supabase
      .from('chore_completions')
      .select('chore_id, user_id, week_of')
      .in('week_of', weeks)
      .in('chore_id', choreIds)
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

  function isDone(choreId: string, weekOf: string) {
    return calCompletions.some(c => c.chore_id === choreId && c.user_id === currentUserId && c.week_of === weekOf)
  }

  // --- Roster assignments ---
  const monthAssignments = getAllGroupAssignments(initGroups, calYear, calMonth)

  type PersonEntry = { displayName: string; avatarColor: string; chores: typeof monthAssignments }
  const byPerson = new Map<string, PersonEntry>()
  for (const a of monthAssignments) {
    const member = members.find(m => m.id === a.userId)
    const color = member?.avatar_color ?? '#82957F'
    if (!byPerson.has(a.userId)) {
      byPerson.set(a.userId, { displayName: a.displayName, avatarColor: color, chores: [] })
    }
    byPerson.get(a.userId)!.chores.push(a)
  }

  async function handleMarkAll(assignments: typeof monthAssignments) {
    for (const a of assignments) {
      if (!isDone(a.chore.id, currentWeekOf)) {
        await markChoreCompleteAction(a.chore.id, currentWeekOf)
      }
    }
    await fetchCompletions(calYear, calMonth)
  }

  async function handleUndoAll(assignments: typeof monthAssignments) {
    for (const a of assignments) {
      if (isDone(a.chore.id, currentWeekOf)) {
        await undoChoreCompleteAction(a.chore.id, currentWeekOf)
      }
    }
    await fetchCompletions(calYear, calMonth)
  }

  // --- Group modal ---
  function openAddGroup() {
    setEditingGroup(null)
    setModalChores(initAllChores)
    groupForm.setFieldsValue({
      name: '',
      chore_ids: [],
      member_ids: [],
      start_year: thisYear,
      start_month: thisMonth,
    })
    setGroupModalOpen(true)
  }

  function openEditGroup(group: ChoreGroup) {
    setEditingGroup(group)
    setModalChores(initAllChores)
    const sortedChores = [...group.chores].sort((a, b) => a.slot_index - b.slot_index)
    const sortedMembers = [...group.chore_group_members].sort((a, b) => a.slot_index - b.slot_index)
    groupForm.setFieldsValue({
      name: group.name,
      chore_ids: sortedChores.map(c => c.id),
      member_ids: sortedMembers.map(m => m.user_id),
      start_year: group.rotation_start_year,
      start_month: group.rotation_start_month,
    })
    setGroupModalOpen(true)
  }

  async function addNewChoreInline() {
    if (!householdId || !newChoreTitle.trim()) return
    setNewChoreLoading(true)
    const { data: chore, error } = await supabase
      .from('chores')
      .insert({ household_id: householdId, title: newChoreTitle.trim(), recurrence: 'weekly' })
      .select()
      .single()
    setNewChoreLoading(false)
    if (error || !chore) { message.error(error?.message ?? 'Failed to add chore'); return }

    const newEntry = { id: chore.id, title: chore.title, slot_index: 0, group_id: null }
    setModalChores(prev => [...prev, newEntry])
    // Auto-select the new chore
    const current = groupForm.getFieldValue('chore_ids') ?? []
    groupForm.setFieldValue('chore_ids', [...current, chore.id])
    setNewChoreTitle('')
    message.success('Chore added')
  }

  async function saveGroup(values: { name: string; chore_ids: string[]; member_ids: string[]; start_year: number; start_month: number }) {
    if (!householdId) return
    setGroupLoading(true)
    if (editingGroup) {
      const result = await updateChoreGroupAction(
        editingGroup.id, values.name,
        values.chore_ids ?? [], values.member_ids ?? [],
        values.start_year, values.start_month
      )
      if (result.error) { message.error(result.error); setGroupLoading(false); return }
      message.success('Group updated')
    } else {
      const result = await createChoreGroupAction(
        householdId, values.name,
        values.chore_ids ?? [], values.member_ids ?? [],
        values.start_year, values.start_month
      )
      if (result.error) { message.error(result.error); setGroupLoading(false); return }
      message.success('Group created')
    }
    setGroupLoading(false)
    setGroupModalOpen(false)
    groupForm.resetFields()
    router.refresh()
  }

  async function deleteGroup(groupId: string) {
    const result = await deleteChoreGroupAction(groupId)
    if (result.error) { message.error(result.error); return }
    message.success('Group deleted')
    router.refresh()
  }

  async function deleteUngroupedChore(choreId: string) {
    await supabase.from('chores').delete().eq('id', choreId)
    router.refresh()
  }

  async function addUngroupedChore(values: { title: string }) {
    if (!householdId) return
    setUngroupedLoading(true)
    const { error } = await supabase
      .from('chores')
      .insert({ household_id: householdId, title: values.title.trim(), recurrence: 'weekly' })
    setUngroupedLoading(false)
    if (error) { message.error(error.message); return }
    message.success('Chore added')
    setAddUngroupedOpen(false)
    ungroupedForm.resetFields()
    router.refresh()
  }

  // --- Roster content ---
  const rosterContent = (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <Button icon={<LeftOutlined />} type="text" size="small" onClick={prevMonth} />
        <Text strong style={{ fontSize: 15 }}>{MONTH_FULL[calMonth - 1]} {calYear}</Text>
        <Button icon={<RightOutlined />} type="text" size="small" onClick={nextMonth} />
      </div>

      {initGroups.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <Text type="secondary">No rotation groups set up yet. Add one in the Manage tab.</Text>
        </div>
      ) : byPerson.size === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <Text type="secondary">No assignments for this month. Make sure groups have chores and members.</Text>
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {Array.from(byPerson.entries()).map(([userId, { displayName, avatarColor, chores: personChores }]) => {
            const isMe = userId === currentUserId
            const color = isMe ? '#82957F' : (avatarColor || '#82957F')
            const allDone = personChores.every(a => isDone(a.chore.id, currentWeekOf))
            return (
              <div key={userId} style={{
                flex: '1 1 150px', minWidth: 130, maxWidth: 220,
                border: `1px solid ${isMe ? '#82957F' : color + '44'}`,
                borderRadius: 12,
                overflow: 'hidden',
                background: '#fff',
              }}>
                <div style={{
                  background: `${color}18`,
                  borderBottom: `1px solid ${color}33`,
                  padding: '10px 14px',
                }}>
                  <Text style={{
                    fontSize: 11, fontWeight: 700, letterSpacing: '1px',
                    textTransform: 'uppercase', color: color, display: 'block'
                  }}>
                    {isMe ? 'You' : displayName}
                  </Text>
                </div>
                <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {personChores.map(a => {
                    const done = isDone(a.chore.id, currentWeekOf)
                    return (
                      <div key={a.chore.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <div style={{
                          width: 16, height: 16, borderRadius: 4, flexShrink: 0, marginTop: 1,
                          border: `1.5px solid ${done ? color : '#d9d9d9'}`,
                          background: done ? color : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {done && <span style={{ color: '#fff', fontSize: 10, fontWeight: 700 }}>✓</span>}
                        </div>
                        <Text style={{
                          fontSize: 13,
                          textDecoration: done ? 'line-through' : undefined,
                          color: done ? '#bfbfbf' : '#3d3d3d',
                          flex: 1,
                        }}>
                          {a.chore.title}
                        </Text>
                      </div>
                    )
                  })}
                  {isMe && isCurrentMonth && personChores.length > 0 && (
                    <div style={{ marginTop: 4 }}>
                      {allDone ? (
                        <Button
                          size="small" type="text"
                          style={{ fontSize: 11, color: '#bfbfbf', padding: 0, height: 'auto' }}
                          onClick={() => handleUndoAll(personChores)}
                        >
                          Undo all
                        </Button>
                      ) : (
                        <Button
                          size="small" type="primary"
                          style={{ fontSize: 11, width: '100%' }}
                          onClick={() => handleMarkAll(personChores)}
                        >
                          Mark done
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )

  // --- Manage content ---
  const ungroupedChores = initAllChores.filter(c => c.group_id === null)

  const manageContent = (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text strong>Rotation Groups</Text>
        <Button size="small" icon={<PlusOutlined />} onClick={openAddGroup}>Add Group</Button>
      </div>

      {initGroups.length === 0 ? (
        <Text type="secondary" style={{ display: 'block', marginBottom: 20 }}>No groups yet.</Text>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {initGroups.map(group => {
            const sortedChores = [...group.chores].sort((a, b) => a.slot_index - b.slot_index)
            const sortedMembers = [...group.chore_group_members]
              .filter(m => m.profile !== null)
              .sort((a, b) => a.slot_index - b.slot_index)
            return (
              <div key={group.id} style={{
                border: '1px solid #f0f0f0', borderRadius: 8,
                overflow: 'hidden',
              }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 14px', background: '#fafafa',
                  borderBottom: '1px solid #f0f0f0',
                }}>
                  <Text strong style={{ fontSize: 13 }}>{group.name}</Text>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <Button icon={<EditOutlined />} type="text" size="small" onClick={() => openEditGroup(group)} />
                    <Popconfirm title="Delete this group?" onConfirm={() => deleteGroup(group.id)}>
                      <Button icon={<DeleteOutlined />} type="text" danger size="small" />
                    </Popconfirm>
                  </div>
                </div>
                <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    <strong>Chores:</strong> {sortedChores.length ? sortedChores.map(c => c.title).join(' → ') : 'None'}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    <strong>Members:</strong> {sortedMembers.length ? sortedMembers.map(m => m.profile!.display_name).join(' → ') : 'None'}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    <strong>Starts:</strong> {MONTHS[group.rotation_start_month - 1]} {group.rotation_start_year}
                  </Text>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Divider plain />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <Text strong>Ungrouped Chores</Text>
        <Button size="small" icon={<PlusOutlined />} onClick={() => { ungroupedForm.resetFields(); setAddUngroupedOpen(true) }}>Add</Button>
      </div>

      {ungroupedChores.length === 0 ? (
        <Text type="secondary" style={{ fontSize: 12 }}>No ungrouped chores.</Text>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {ungroupedChores.map(c => (
            <div key={c.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '7px 12px', borderRadius: 6, border: '1px solid #f0f0f0',
            }}>
              <Text style={{ fontSize: 13 }}>{c.title}</Text>
              <Popconfirm title="Delete this chore?" onConfirm={() => deleteUngroupedChore(c.id)}>
                <Button icon={<DeleteOutlined />} type="text" danger size="small" />
              </Popconfirm>
            </div>
          ))}
        </div>
      )}
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

      {/* Add/Edit Group Modal */}
      <Modal
        title={editingGroup ? 'Edit Group' : 'Add Group'}
        open={groupModalOpen}
        onCancel={() => { setGroupModalOpen(false); groupForm.resetFields() }}
        footer={null}
        width={480}
      >
        <Form form={groupForm} layout="vertical" onFinish={saveGroup} requiredMark={false}>
          <Form.Item name="name" label="Group name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Bedroom & Living" />
          </Form.Item>

          <Form.Item name="chore_ids" label="Chores (in rotation order)">
            <Select
              mode="multiple"
              options={modalChores.map(c => ({ value: c.id, label: c.title }))}
              placeholder="Select chores in order"
            />
          </Form.Item>

          {/* Inline new chore */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, marginTop: -8 }}>
            <Input
              size="small"
              placeholder="New chore name"
              value={newChoreTitle}
              onChange={e => setNewChoreTitle(e.target.value)}
              onPressEnter={addNewChoreInline}
              style={{ flex: 1 }}
            />
            <Button size="small" loading={newChoreLoading} onClick={addNewChoreInline} disabled={!newChoreTitle.trim()}>
              Add
            </Button>
          </div>

          <Form.Item name="member_ids" label="Members (in rotation order)">
            <Select
              mode="multiple"
              options={members.map(m => ({ value: m.id, label: m.display_name }))}
              placeholder="Select members in order"
            />
          </Form.Item>

          <div>
            <Text style={{ fontSize: 14, fontWeight: 500 }}>Rotation starts</Text>
            <Row gutter={12} style={{ marginTop: 8 }}>
              <Col span={12}>
                <Form.Item name="start_year" rules={[{ required: true }]} style={{ marginBottom: 0 }}>
                  <Select options={[thisYear - 1, thisYear, thisYear + 1].map(y => ({ value: y, label: `${y}` }))} placeholder="Year" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="start_month" rules={[{ required: true }]} style={{ marginBottom: 0 }}>
                  <Select options={MONTHS.map((m, i) => ({ value: i + 1, label: m }))} placeholder="Month" />
                </Form.Item>
              </Col>
            </Row>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
            <Button onClick={() => { setGroupModalOpen(false); groupForm.resetFields() }}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={groupLoading}>Save</Button>
          </div>
        </Form>
      </Modal>

      {/* Add Ungrouped Chore Modal */}
      <Modal
        title="Add Chore"
        open={addUngroupedOpen}
        onCancel={() => { setAddUngroupedOpen(false); ungroupedForm.resetFields() }}
        footer={null}
      >
        <Form form={ungroupedForm} layout="vertical" onFinish={addUngroupedChore} requiredMark={false}>
          <Form.Item name="title" label="Chore name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Mopping, Vacuuming, Trash" />
          </Form.Item>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => { setAddUngroupedOpen(false); ungroupedForm.resetFields() }}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={ungroupedLoading}>Add</Button>
          </div>
        </Form>
      </Modal>
    </>
  )
}
