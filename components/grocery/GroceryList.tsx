'use client'

import { useState } from 'react'
import {
  App, Button, Input, Checkbox, Typography, Popconfirm,
  Row, Col, Card, Tag
} from 'antd'
import {
  PlusOutlined, DeleteOutlined, ClearOutlined, ShoppingCartOutlined
} from '@ant-design/icons'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import AddExpenseModal from '@/components/expenses/AddExpenseModal'
import type { Profile } from '@/lib/types'

const { Text } = Typography

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 0',
  borderBottom: '1px solid #f0f0f0',
}

type Props = {
  items: any[]
  history: { name: string }[]
  currentUserId: string
  householdId: string | null
  members: Pick<Profile, 'id' | 'display_name'>[]
  defaultCurrency?: string
}

export default function GroceryList({ items, history, currentUserId, householdId, members, defaultCurrency = 'USD' }: Props) {
  const { message } = App.useApp()
  const router = useRouter()
  const supabase = createClient()
  const [name, setName] = useState('')
  const [adding, setAdding] = useState(false)
  const [addingPreset, setAddingPreset] = useState<string | null>(null)
  const [expenseModalOpen, setExpenseModalOpen] = useState(false)
  const [expenseTitle, setExpenseTitle] = useState('')

  async function addItem(itemName = name) {
    if (!itemName.trim() || !householdId) return
    if (itemName === name) setAdding(true)
    else setAddingPreset(itemName)

    const trimmed = itemName.trim()
    const { error } = await supabase.from('grocery_items').insert({
      household_id: householdId,
      name: trimmed,
      added_by: currentUserId,
    })

    if (itemName === name) setAdding(false)
    else setAddingPreset(null)

    if (error) { message.error(error.message); return }

    await supabase.from('grocery_history').upsert(
      { household_id: householdId, name: trimmed, last_added_at: new Date().toISOString() },
      { onConflict: 'household_id,name' }
    )

    if (itemName === name) setName('')
    router.refresh()
  }

  async function toggleItem(id: string, checked: boolean) {
    await supabase.from('grocery_items').update({ checked_off: !checked }).eq('id', id)
    router.refresh()
  }

  async function deleteItem(id: string) {
    await supabase.from('grocery_items').delete().eq('id', id)
    router.refresh()
  }

  async function clearChecked() {
    const ids = items.filter(i => i.checked_off).map(i => i.id)
    if (!ids.length) return
    await supabase.from('grocery_items').delete().in('id', ids)
    router.refresh()
  }

  async function handleBought(item: any) {
    await supabase.from('grocery_items').delete().eq('id', item.id)
    router.refresh()
    setExpenseTitle(item.name)
    setExpenseModalOpen(true)
  }

  const unchecked = items.filter(i => !i.checked_off)
  const checked = items.filter(i => i.checked_off)

  const inListNames = new Set(unchecked.map((i: any) => i.name.toLowerCase()))
  const historyNotInList = history.filter(h => !inListNames.has(h.name.toLowerCase()))

  return (
    <div>
      {/* Custom add row */}
      <Row gutter={8} style={{ marginBottom: 16 }}>
        <Col flex="auto">
          <Input
            placeholder="Item name"
            value={name}
            onChange={e => setName(e.target.value)}
            onPressEnter={() => addItem()}
            disabled={!householdId}
          />
        </Col>
        <Col>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => addItem()}
            loading={adding}
            disabled={!name.trim() || !householdId}
          >
            Add
          </Button>
        </Col>
      </Row>

      {/* Shopping list */}
      <Card style={{ marginBottom: 16 }} styles={{ body: { padding: '0 16px' } }}>
        {unchecked.length === 0 ? (
          <div style={{ padding: '16px 0', textAlign: 'center' }}>
            <Text type="secondary">Nothing to buy</Text>
          </div>
        ) : (
          unchecked.map((item: any) => (
            <div key={item.id} style={rowStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                <Checkbox onChange={() => toggleItem(item.id, item.checked_off)} />
                <Text>{item.name}</Text>
                              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {householdId && (
                  <Button
                    size="small"
                    type="primary"
                    icon={<ShoppingCartOutlined />}
                    onClick={() => handleBought(item)}
                    style={{ fontSize: 11, height: 24, padding: '0 8px' }}
                  >
                    Bought
                  </Button>
                )}
                <Popconfirm title="Remove?" onConfirm={() => deleteItem(item.id)}>
                  <Button icon={<DeleteOutlined />} type="text" size="small" />
                </Popconfirm>
              </div>
            </div>
          ))
        )}

        {checked.length > 0 && (
          <div style={{ padding: '12px 0 8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>In cart ({checked.length})</Text>
              <Button size="small" icon={<ClearOutlined />} onClick={clearChecked}>Clear</Button>
            </div>
            {checked.map((item: any) => (
              <div key={item.id} style={{ ...rowStyle, opacity: 0.5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Checkbox checked onChange={() => toggleItem(item.id, item.checked_off)} />
                  <Text delete type="secondary">{item.name}</Text>
                                  </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* History-based quick add */}
      {historyNotInList.length > 0 && (
        <>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>Add again</Text>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {historyNotInList.map(h => (
              <Button
                key={h.name}
                size="small"
                icon={<PlusOutlined />}
                loading={addingPreset === h.name}
                onClick={() => addItem(h.name)}
              >
                {h.name}
              </Button>
            ))}
          </div>
        </>
      )}

      {/* Expense modal triggered by Bought */}
      {householdId && (
        <AddExpenseModal
          open={expenseModalOpen}
          onClose={() => { setExpenseModalOpen(false); setExpenseTitle('') }}
          members={members}
          currentUserId={currentUserId}
          householdId={householdId}
          defaultCurrency={defaultCurrency}
          initialTitle={expenseTitle}
        />
      )}
    </div>
  )
}
