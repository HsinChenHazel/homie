'use client'

import { useState } from 'react'
import { App, Button, Card, Typography, Grid } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import BalanceSummary from '@/components/BalanceSummary'
import SettlementCard from '@/components/SettlementCard'
import { markChoreCompleteAction } from '@/app/actions'
import { getWeekStart } from '@/lib/chores'
import { useRouter } from 'next/navigation'
import AddExpenseModal from '@/components/expenses/AddExpenseModal'
import NotesBoard from '@/components/NotesBoard'
import type { BalanceData } from '@/lib/balances'
import type { Profile } from '@/lib/types'
import type { MonthlyAssignment } from '@/lib/chores'

const { Title, Text } = Typography

type Props = {
  displayName: string
  householdName: string
  balanceData: BalanceData
  householdId: string
  choreAssignments: MonthlyAssignment[]
  choreCompletions: { chore_id: string; user_id: string }[]
  pendingSettlements: any[]
  currentUserId: string
  unsettledExpenseCount: number
  members: Pick<Profile, 'id' | 'display_name'>[]
  defaultCurrency?: string
  notes?: any[]
}

export default function DashboardContent({
  displayName,
  householdName,
  balanceData,
  householdId,
  choreAssignments,
  choreCompletions: initialCompletions,
  pendingSettlements,
  currentUserId,
  unsettledExpenseCount,
  members,
  defaultCurrency,
  notes = [],
}: Props) {
  const { message } = App.useApp()
  const router = useRouter()
  const screens = Grid.useBreakpoint()
  const isMobile = screens.md === false
  const [completions, setCompletions] = useState(initialCompletions)
  const [loadingChoreId, setLoadingChoreId] = useState<string | null>(null)
  const [addExpenseOpen, setAddExpenseOpen] = useState(false)
  const weekOf = getWeekStart()

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

  const choreCard = myChore ? (
    <Card
      style={{ marginBottom: 16 }}
      title="Chore this week"
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <Text
          style={{
            fontSize: 22,
            fontWeight: 300,
            lineHeight: 1.2,
            minWidth: 0,
            flex: 1,
            textDecoration: myDone ? 'line-through' : undefined,
            color: myDone ? '#8c8c8c' : undefined,
          }}
        >
          {myChore.chore.title}
        </Text>
        {!myDone && (
          <Button type="primary" size="small" loading={loadingChoreId === myChore.chore.id} onClick={handleDone} style={{ fontSize: 12, height: 28, padding: '0 12px', flexShrink: 0 }}>
            Done
          </Button>
        )}
      </div>
    </Card>
  ) : null

  if (isMobile) {
    return (
      <div>
        <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>Hello, {displayName} · {householdName}</Text>

        {choreCard}

        {pendingSettlements.map((s: any) => (
          <SettlementCard key={s.id} settlement={s} currentUserId={currentUserId} />
        ))}
        {balanceData.transactions.length > 0 && (
          <BalanceSummary
            data={balanceData}
            householdId={householdId}
            compact
            expenseCount={unsettledExpenseCount}
          />
        )}

        <NotesBoard notes={notes} householdId={householdId} currentUserId={currentUserId} />
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
      <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>{householdName}</Text>

      {choreCard}

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

      <NotesBoard notes={notes} householdId={householdId} currentUserId={currentUserId} />

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
