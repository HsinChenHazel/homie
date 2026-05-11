'use client'

import { useState } from 'react'
import {
  App, Modal, Form, Input, InputNumber, DatePicker, Select,
  Button, Typography, Divider, Row, Col, Tabs, Tag
} from 'antd'
import { createClient } from '@/lib/supabase/client'
import { createUtilityExpenseAction } from '@/app/actions'
import { useRouter } from 'next/navigation'
import dayjs from 'dayjs'
import type { Profile } from '@/lib/types'
import { Zap, Flame, Wifi, Droplets, Home, MoreHorizontal } from 'lucide-react'

const { Text } = Typography

const CURRENCIES = ['USD', 'TWD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'HKD', 'SGD']

const UTILITY_CATEGORIES = [
  { key: 'electricity', label: 'Electricity', icon: <Zap size={14} /> },
  { key: 'gas', label: 'Gas', icon: <Flame size={14} /> },
  { key: 'internet', label: 'Internet', icon: <Wifi size={14} /> },
  { key: 'water', label: 'Water', icon: <Droplets size={14} /> },
  { key: 'other', label: 'Other', icon: <MoreHorizontal size={14} /> },
]

export function utilityLabel(category: string) {
  return UTILITY_CATEGORIES.find(c => c.key === category)?.label ?? category
}

export function utilityIcon(category: string) {
  return UTILITY_CATEGORIES.find(c => c.key === category)?.icon ?? null
}

type Props = {
  open: boolean
  onClose: () => void
  members: Pick<Profile, 'id' | 'display_name'>[]
  currentUserId: string
  householdId: string
  defaultCurrency?: string
  initialTitle?: string
}

export default function AddExpenseModal({
  open, onClose, members, currentUserId, householdId, defaultCurrency = 'USD', initialTitle = ''
}: Props) {
  const { message } = App.useApp()
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [splitType, setSplitType] = useState<'equal' | 'custom'>('equal')
  const [tab, setTab] = useState<'expense' | 'utility'>('expense')
  const [utilityCategory, setUtilityCategory] = useState<string>('')
  const [form] = Form.useForm()
  const [utilityForm] = Form.useForm()

  function handleClose() {
    onClose()
    form.resetFields()
    utilityForm.resetFields()
    setSplitType('equal')
    setUtilityCategory('')
    setTab('expense')
  }

  async function handleAdd(values: any) {
    setLoading(true)
    const amount = Number(values.amount)
    const splitMembers: string[] = values.split_members ?? members.map(m => m.id)

    const { data: expense, error } = await supabase
      .from('expenses')
      .insert({
        household_id: householdId,
        paid_by: currentUserId,
        title: values.title,
        amount,
        date: values.date.format('YYYY-MM-DD'),
        split_type: splitType,
        currency: values.currency ?? defaultCurrency,
      })
      .select()
      .single()

    if (error || !expense) {
      message.error('Failed to add expense')
      setLoading(false)
      return
    }

    let splits: { expense_id: string; user_id: string; amount_owed: number }[]
    if (splitType === 'equal') {
      const each = amount / splitMembers.length
      splits = splitMembers.map(uid => ({
        expense_id: expense.id,
        user_id: uid,
        amount_owed: parseFloat(each.toFixed(2)),
      }))
    } else {
      splits = splitMembers.map(uid => ({
        expense_id: expense.id,
        user_id: uid,
        amount_owed: Number(values[`custom_${uid}`] ?? 0),
      }))
    }

    await supabase.from('expense_splits').insert(splits)
    message.success('Expense added')
    setLoading(false)
    handleClose()
    router.refresh()
  }

  async function handleAddUtility(values: any) {
    if (!utilityCategory) { message.error('Please select a category'); return }
    setLoading(true)

    const amount = Number(values.amount)
    const splitMembers: string[] = values.split_members ?? members.map(m => m.id)
    const each = parseFloat((amount / splitMembers.length).toFixed(2))
    const title = utilityCategory === 'other' ? (values.custom_title || 'Other utility') : utilityLabel(utilityCategory)

    const result = await createUtilityExpenseAction(
      householdId,
      title,
      amount,
      values.date.format('YYYY-MM-DD'),
      values.currency ?? defaultCurrency,
      utilityCategory,
      splitMembers.map(uid => ({ userId: uid, amountOwed: each }))
    )

    setLoading(false)
    if (result.error) { message.error(result.error); return }
    message.success('Utility bill added — settlement created automatically.')
    handleClose()
    router.refresh()
  }

  const expenseTab = (
    <Form form={form} layout="vertical" onFinish={handleAdd} requiredMark={false} initialValues={{ title: initialTitle }}>
      <Form.Item name="title" label="Description" rules={[{ required: true }]}>
        <Input placeholder="e.g. Groceries, Dinner" />
      </Form.Item>
      <Row gutter={12}>
        <Col span={8}>
          <Form.Item name="currency" label="Currency" initialValue={defaultCurrency}>
            <Select options={CURRENCIES.map(c => ({ value: c, label: c }))} />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item name="amount" label="Amount" rules={[{ required: true }]}>
            <InputNumber min={0.01} style={{ width: '100%' }} step={0.01} />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item name="date" label="Date" rules={[{ required: true }]} initialValue={dayjs()}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Col>
      </Row>
      <Divider plain>Split</Divider>
      <Form.Item label="Split type">
        <Select value={splitType} onChange={setSplitType} options={[
          { value: 'equal', label: 'Equal split' },
          { value: 'custom', label: 'Custom amounts' },
        ]} />
      </Form.Item>
      {splitType === 'equal' && (
        <Form.Item name="split_members" label="Split between" initialValue={members.map(m => m.id)}>
          <Select mode="multiple" options={members.map(m => ({ value: m.id, label: m.display_name }))} placeholder="All members" />
        </Form.Item>
      )}
      {splitType === 'custom' && (
        <>
          <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>Enter each person&apos;s share:</Text>
          {members.map(m => (
            <Form.Item key={m.id} name={`custom_${m.id}`} label={m.display_name}>
              <InputNumber min={0} step={0.01} prefix="$" style={{ width: '100%' }} />
            </Form.Item>
          ))}
        </>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
        <Button onClick={handleClose}>Cancel</Button>
        <Button type="primary" htmlType="submit" loading={loading}>Add</Button>
      </div>
    </Form>
  )

  const utilityTab = (
    <Form form={utilityForm} layout="vertical" onFinish={handleAddUtility} requiredMark={false}>
      <Form.Item label="Category" required>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {UTILITY_CATEGORIES.map(c => (
            <Tag
              key={c.key}
              onClick={() => setUtilityCategory(c.key)}
              style={{
                cursor: 'pointer',
                padding: '5px 12px',
                fontSize: 13,
                borderRadius: 6,
                border: `1px solid ${utilityCategory === c.key ? '#4361EE' : '#d9d9d9'}`,
                background: utilityCategory === c.key ? '#eef1ff' : '#fafafa',
                color: utilityCategory === c.key ? '#4361EE' : undefined,
                userSelect: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              {c.icon}{c.label}
            </Tag>
          ))}
        </div>
      </Form.Item>

      {utilityCategory === 'other' && (
        <Form.Item name="custom_title" label="Description" rules={[{ required: true }]}>
          <Input placeholder="e.g. Management fee" />
        </Form.Item>
      )}

      <Row gutter={12}>
        <Col span={8}>
          <Form.Item name="currency" label="Currency" initialValue={defaultCurrency}>
            <Select options={CURRENCIES.map(c => ({ value: c, label: c }))} />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item name="amount" label="Amount" rules={[{ required: true }]}>
            <InputNumber min={0.01} style={{ width: '100%' }} step={0.01} />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item name="date" label="Date" rules={[{ required: true }]} initialValue={dayjs()}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item name="split_members" label="Split between" initialValue={members.map(m => m.id)}>
        <Select mode="multiple" options={members.map(m => ({ value: m.id, label: m.display_name }))} placeholder="All members" />
      </Form.Item>

      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
        A settlement will be created automatically — each person can confirm once they&apos;ve paid.
      </Text>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Button onClick={handleClose}>Cancel</Button>
        <Button type="primary" htmlType="submit" loading={loading}>Add &amp; Settle</Button>
      </div>
    </Form>
  )

  return (
    <Modal
      title="Add Expense"
      open={open}
      onCancel={handleClose}
      footer={null}
      width={520}
    >
      <Tabs
        activeKey={tab}
        onChange={k => setTab(k as 'expense' | 'utility')}
        items={[
          { key: 'expense', label: 'Expense', children: expenseTab, forceRender: true },
          { key: 'utility', label: <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Home size={13} />Utility Bill</span>, children: utilityTab, forceRender: true },
        ]}
      />
    </Modal>
  )
}
