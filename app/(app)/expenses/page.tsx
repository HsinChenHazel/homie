export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ExpenseList from '@/components/expenses/ExpenseList'
import BalanceSummary from '@/components/BalanceSummary'
import SettlementCard from '@/components/SettlementCard'
import { calculateBalances } from '@/lib/balances'

export default async function ExpensesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('household_id')
    .eq('id', user.id)
    .single()

  const householdId = profile?.household_id

  const defaultCurrency = householdId
    ? await supabase
        .from('households')
        .select('default_currency')
        .eq('id', householdId)
        .single()
        .then(r => (r.data as any)?.default_currency ?? 'USD')
        .catch(() => 'USD')
    : 'USD'

  const [expensesRes, newSplitsRes, allSplitsRes, membersRes, settlementsRes] = await Promise.all([
    householdId
      ? supabase
          .from('expenses')
          .select('*, paid_by_profile:profiles!paid_by(id, display_name), splits:expense_splits(*, profile:profiles(id, display_name))')
          .eq('household_id', householdId)
          .order('date', { ascending: false })
      : { data: [] },
    // New unsettled splits (not yet in any settlement)
    householdId
      ? supabase
          .from('expense_splits')
          .select('user_id, amount_owed, profile:profiles(id, display_name), expense:expenses!inner(paid_by, amount, household_id, paid_by_profile:profiles!paid_by(id, display_name))')
          .eq('expense.household_id', householdId)
          .eq('settled', false)
          .is('settlement_id', null)
      : { data: [] },
    // All unsettled splits (including those in pending settlements) — for merged recalculation
    householdId
      ? supabase
          .from('expense_splits')
          .select('user_id, amount_owed, profile:profiles(id, display_name), expense:expenses!inner(paid_by, amount, household_id, paid_by_profile:profiles!paid_by(id, display_name))')
          .eq('expense.household_id', householdId)
          .eq('settled', false)
      : { data: [] },
    householdId
      ? supabase.from('profiles').select('id, display_name').eq('household_id', householdId)
      : { data: [] },
    householdId
      ? supabase
          .from('settlements')
          .select('id, created_at, status, expense_count, settlement_type, utility_category, created_by, created_by_profile:profiles!created_by(id, display_name), settlement_items(id, from_user_id, to_user_id, amount, paid_at, from_profile:profiles!from_user_id(id, display_name, avatar_color, avatar_initials), to_profile:profiles!to_user_id(id, display_name, avatar_color, avatar_initials)), linked_splits:expense_splits(expense:expenses!inner(expense_type, utility_category))')
          .eq('household_id', householdId)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
      : { data: [] },
  ])

  const expenses = expensesRes.data ?? []
  const newSplits = newSplitsRes.data ?? []
  const allSplits = allSplitsRes.data ?? []
  const pendingSettlements = (settlementsRes.data ?? []) as any[]

  // Balance for new expenses only (shown in the card header)
  const newExpenseMap = new Map()
  for (const s of newSplits) {
    const e = (s as any).expense
    if (e && !newExpenseMap.has(e.paid_by + e.amount)) newExpenseMap.set(e.paid_by + e.amount, e)
  }
  const balanceData = householdId
    ? calculateBalances(newSplits as any, Array.from(newExpenseMap.values()))
    : null

  // Merged balance — all unsettled (used when recalculating over a pending settlement)
  const allExpenseMap = new Map()
  for (const s of allSplits) {
    const e = (s as any).expense
    if (e && !allExpenseMap.has(e.paid_by + e.amount)) allExpenseMap.set(e.paid_by + e.amount, e)
  }
  const mergedBalanceData = householdId
    ? calculateBalances(allSplits as any, Array.from(allExpenseMap.values()))
    : null

  const pendingSettlementItems = pendingSettlements.flatMap((s: any) =>
    (s.settlement_items ?? []).map((item: any) => ({
      fromName: item.from_profile?.display_name ?? '',
      toName: item.to_profile?.display_name ?? '',
      amount: item.amount,
    }))
  )

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>Expenses</h2>

      {/* Active pending settlements */}
      {pendingSettlements.map((s: any) => (
        <SettlementCard key={s.id} settlement={s} currentUserId={user.id} />
      ))}

      {/* Balance card: only show new expenses not yet in any settlement */}
      {householdId && (balanceData?.transactions.length ?? 0) > 0 && (
        <BalanceSummary
          data={balanceData!}
          householdId={householdId}
          expenseCount={newExpenseMap.size}
          pendingSettlementIds={pendingSettlements.map((s: any) => s.id)}
          pendingSettlementItems={pendingSettlementItems}
          mergedData={mergedBalanceData ?? undefined}
        />
      )}

      <ExpenseList
        expenses={expenses}
        members={membersRes.data ?? []}
        currentUserId={user.id}
        householdId={householdId ?? null}
        defaultCurrency={defaultCurrency}
      />
    </div>
  )
}
