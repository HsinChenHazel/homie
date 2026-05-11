'use client'

import { useState } from 'react'
import { App, Button, Card, Col, Row, Statistic, Typography, Input, Grid, Modal, Empty } from 'antd'
import { CheckCircleOutlined, ShoppingCartOutlined, CheckOutlined, PlusOutlined } from '@ant-design/icons'
import { Check } from 'lucide-react'
import BalanceSummary from '@/components/BalanceSummary'
import SettlementCard from '@/components/SettlementCard'
import AddExpenseFAB from '@/components/AddExpenseFAB'
import { markChoreCompleteAction } from '@/app/actions'
import { getWeekStart } from '@/lib/chores'
import { useRouter } from 'next/navigation'
import AddExpenseModal from '@/components/expenses/AddExpenseModal'
import { createClient } from '@/lib/supabase/client'
import type { BalanceData } from '@/lib/balances'
import type { Profile } from '@/lib/types'
import type { MonthlyAssignment } from '@/lib/chores'

const { Title, Text } = Typography

const itemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 0',
  borderBottom: '1px solid #f0f0f0',
}

type Props = {
  displayName: string
  householdName: string
  totalSpentThisMonth: number
  myBalance: number
  balanceData: BalanceData
  householdId: string
  choreAssignments: MonthlyAssignment[]
  choreCompletions: { chore_id: string; user_id: string }[]
  groceryItems: any[]
  groceryHistory: { name: string }[]
  pendingSettlements: any[]
  currentUserId: string
  unsettledExpenseCount: number
  members: Pick<Profile, 'id' | 'display_name'>[]
  defaultCurrency?: string
}

export default function DashboardContent({
  displayName,
  householdName,
  totalSpentThisMonth,
  myBalance,
  balanceData,
  householdId,
  choreAssignments,
  choreCompletions: initialCompletions,
  groceryItems,
  groceryHistory,
  pendingSettlements,
  currentUserId,
  unsettledExpenseCount,
  members,
  defaultCurrency,
}: Props) {
  const { message } = App.useApp()
  const router = useRouter()
  const screens = Grid.useBreakpoint()
  const isMobile = screens.md === false
  const [completions, setCompletions] = useState(initialCompletions)
  const [loadingChoreId, setLoadingChoreId] = useState<string | null>(null)
  const [groceryExpenseOpen, setGroceryExpenseOpen] = useState(false)
  const [groceryExpenseTitle, setGroceryExpenseTitle] = useState('')
  const [addExpenseOpen, setAddExpenseOpen] = useState(false)
  const [groceryName, setGroceryName] = useState('')
  const [addingGrocery, setAddingGrocery] = useState(false)
  const [historyPopoverOpen, setHistoryPopoverOpen] = useState(false)
  const [addingFromHistory, setAddingFromHistory] = useState<string | null>(null)
  const weekOf = getWeekStart()
  const supabase = createClient()

  const inListNames = new Set(groceryItems.map((i: any) => i.name.toLowerCase()))
  const historyNotInList = groceryHistory.filter(h => !inListNames.has(h.name.toLowerCase()))

  async function addGroceryItem(itemName = groceryName) {
    const trimmed = itemName.trim()
    if (!trimmed || !householdId) return
    if (itemName === groceryName) setAddingGrocery(true)
    await supabase.from('grocery_items').insert({ household_id: householdId, name: trimmed, added_by: currentUserId })
    await supabase.from('grocery_history').upsert(
      { household_id: householdId, name: trimmed, last_added_at: new Date().toISOString() },
      { onConflict: 'household_id,name' }
    )
    if (itemName === groceryName) { setAddingGrocery(false); setGroceryName('') }
    router.refresh()
  }

  async function addFromHistory(name: string) {
    setAddingFromHistory(name)
    await addGroceryItem(name)
    setAddingFromHistory(null)
    setHistoryPopoverOpen(false)
  }

  const myChore = choreAssignments.find(a => a.userId === currentUserId)
  const myDone = myChore
    ? completions.some(c => c.chore_id === myChore.chore.id && c.user_id === currentUserId)
    : false

  async function handleDone() {
    if (!myChore) return
    setLoadingChoreId(myChore.chore.id)
    const result = await markChoreCompleteAction(myChore.chore.id, weekOf)
    setLoadingChoreId(null)
    if (result.error) { message.error(result.error); return }
    setCompletions(prev => [...prev, { chore_id: myChore.chore.id, user_id: currentUserId }])
  }

  const shoppingListCard = (
    <Card
      title={<><ShoppingCartOutlined /> Shopping List</>}
      extra={
        <Button size="small" icon={<PlusOutlined />} onClick={() => setHistoryPopoverOpen(true)}>
          Add
        </Button>
      }
    >
      {groceryItems.length === 0 ? (
        <Text type="secondary" style={{ display: 'block', textAlign: 'center', padding: '16px 0' }}>Nothing needed yet</Text>
      ) : (
        <div>
          {groceryItems.map((item: any) => (
            <div key={item.id} style={itemStyle}>
              <Text>{item.name}</Text>
              <Button
                size="small"
                type="primary"
                style={{ fontSize: 11, height: 24, padding: '0 8px' }}
                onClick={async () => {
                  await supabase.from('grocery_items').update({ checked_off: true }).eq('id', item.id)
                  router.refresh()
                  setGroceryExpenseTitle(item.name)
                  setGroceryExpenseOpen(true)
                }}
              >
                Bought
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  )

  const choresCard = (
    <Card title={<><CheckCircleOutlined /> Chores This Week</>}>
      {choreAssignments.length === 0 ? (
        <Empty description="No rotation set up yet" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {choreAssignments.map(({ chore, userId, displayName: name }) => {
            const done = completions.some(c => c.chore_id === chore.id && c.user_id === userId)
            return (
              <div key={chore.id} style={{ ...itemStyle, opacity: done ? 0.5 : 1 }}>
                <div>
                  <Text style={{ textDecoration: done ? 'line-through' : undefined }}>
                    {chore.title}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                    {userId === currentUserId ? 'You' : name}
                  </Text>
                </div>
                {done && <Check size={14} color="#4361EE" />}
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )

  const historyModal = (
    <Modal
      open={historyPopoverOpen}
      onCancel={() => setHistoryPopoverOpen(false)}
      footer={null}
      title="Add to list"
      centered
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Manual input */}
        <div style={{ display: 'flex', gap: 8 }}>
          <Input
            placeholder="Item name"
            value={groceryName}
            onChange={e => setGroceryName(e.target.value)}
            onPressEnter={() => addGroceryItem()}
            autoFocus
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            loading={addingGrocery}
            disabled={!groceryName.trim()}
            onClick={() => addGroceryItem()}
          />
        </div>

        {/* History */}
        {historyNotInList.length > 0 && (
          <div>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>Add again</Text>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {historyNotInList.map(h => (
                <Button
                  key={h.name}
                  size="small"
                  icon={<PlusOutlined />}
                  loading={addingFromHistory === h.name}
                  onClick={() => addFromHistory(h.name)}
                >
                  {h.name}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )

  const expenseModal = members.length > 0 && householdId && (
    <AddExpenseModal
      open={groceryExpenseOpen}
      onClose={() => { setGroceryExpenseOpen(false); setGroceryExpenseTitle('') }}
      members={members}
      currentUserId={currentUserId}
      householdId={householdId}
      defaultCurrency={defaultCurrency}
      initialTitle={groceryExpenseTitle}
    />
  )

  if (isMobile) {
    return (
      <div>
        <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>Hello, {displayName} · {householdName}</Text>

        {/* My spend + Your chore side by side */}
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          <Col xs={12} style={{ display: 'flex' }}>
            <Card style={{ flex: 1 }} styles={{ body: { padding: '12px 14px' } }}>
              <Statistic
                title="My spend this month"
                value={totalSpentThisMonth}
                prefix="$"
                precision={2}
                styles={{ title: { fontSize: 12 }, content: { fontSize: 20, color: '#1677ff' } }}
              />
            </Card>
          </Col>
          <Col xs={12} style={{ display: 'flex' }}>
            <Card style={{ flex: 1 }} styles={{ body: { padding: '12px 14px' } }}>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Your chore</Text>
              <Text
                strong
                style={{
                  fontSize: 15,
                  display: 'block',
                  marginBottom: 8,
                  textDecoration: myDone ? 'line-through' : undefined,
                  color: myDone ? '#8c8c8c' : undefined,
                }}
              >
                {myChore?.chore.title ?? '—'}
              </Text>
              {myChore && !myDone && (
                <Button type="primary" size="small" icon={<CheckOutlined />} loading={loadingChoreId === myChore.chore.id} onClick={handleDone} style={{ fontSize: 11, height: 24, padding: '0 8px' }}>Done</Button>
              )}
            </Card>
          </Col>
        </Row>

        {/* Settlements / balance */}
        {pendingSettlements.map((s: any) => (
          <SettlementCard key={s.id} settlement={s} currentUserId={currentUserId} />
        ))}
        {pendingSettlements.length === 0 && balanceData.transactions.length > 0 && (
          <BalanceSummary
            data={balanceData}
            householdId={householdId}
            compact
            expenseCount={unsettledExpenseCount}
          />
        )}

        {/* Shopping list */}
        <div style={{ marginBottom: 16 }}>{shoppingListCard}</div>

        {/* Full chore list */}
        {choresCard}

        {expenseModal}
        {historyModal}
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
        <Title level={2} style={{ margin: 0 }}>Hello, {displayName}</Title>
        {householdId && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddExpenseOpen(true)}>
            Add Expense
          </Button>
        )}
      </div>
      <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
        {householdName}
      </Text>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }} align="stretch">
        <Col xs={24} sm={8} style={{ display: 'flex' }}>
          <Card style={{ flex: 1 }}>
            <Statistic
              title="My spend this month"
              value={totalSpentThisMonth}
              prefix="$"
              precision={2}
              styles={{ content: { color: '#1677ff' } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8} style={{ display: 'flex' }}>
          <Card style={{ flex: 1 }}>
            <Statistic
              title={myBalance >= 0 ? 'You are owed' : 'You owe'}
              value={Math.abs(myBalance)}
              prefix="$"
              precision={2}
              styles={{ content: { color: myBalance >= 0 ? '#3f8600' : '#cf1322' } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8} style={{ display: 'flex' }}>
          <Card style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Statistic
                title="Your chore this week"
                value={myChore?.chore.title ?? '—'}
                styles={{
                  content: {
                    fontSize: 20,
                    textDecoration: myDone ? 'line-through' : undefined,
                    color: myDone ? '#8c8c8c' : undefined,
                  }
                }}
              />
              {myChore && !myDone && (
                <Button type="primary" size="small" icon={<CheckOutlined />} loading={loadingChoreId === myChore.chore.id} onClick={handleDone} style={{ fontSize: 11, height: 24, padding: '0 8px' }}>Done</Button>
              )}
            </div>
          </Card>
        </Col>
      </Row>

      {/* Pending settlements */}
      {pendingSettlements.map((s: any) => (
        <SettlementCard key={s.id} settlement={s} currentUserId={currentUserId} />
      ))}

      {/* Balance summary */}
      {pendingSettlements.length === 0 && balanceData.transactions.length > 0 && (
        <BalanceSummary
          data={balanceData}
          householdId={householdId}
          compact
          expenseCount={unsettledExpenseCount}
        />
      )}

      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>{choresCard}</Col>
        <Col xs={24} md={12}>{shoppingListCard}</Col>
      </Row>

      {expenseModal}
      {historyModal}
      {householdId && members.length > 0 && (
        <AddExpenseModal
          open={addExpenseOpen}
          onClose={() => setAddExpenseOpen(false)}
          members={members}
          currentUserId={currentUserId}
          householdId={householdId}
          defaultCurrency={defaultCurrency}
        />
      )}
    </div>
  )
}
