export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardContent from '@/components/DashboardContent'
import NoHousehold from '@/components/NoHousehold'
import { calculateBalances } from '@/lib/balances'
import { getMonthlyAssignments, getWeekStart } from '@/lib/chores'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, household:households(*)')
    .eq('id', user.id)
    .single()

  if (!profile?.household_id) return <NoHousehold />

  const householdId = profile.household_id
  const household = (profile.household as any)
  const weekOf = getWeekStart()

  const now = new Date()
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

  // Get this month's expense IDs first, then sum my splits for those
  const { data: monthExpenses } = await supabase
    .from('expenses')
    .select('id')
    .eq('household_id', householdId)
    .gte('date', firstOfMonth)

  const monthExpenseIds = (monthExpenses ?? []).map(e => e.id)

  const [mySpendRes, splitsRes, groceryRes, groceryHistoryRes, settlementsRes, membersRes,
         choresRes, rotationRes, completionsRes] = await Promise.all([
    monthExpenseIds.length
      ? supabase
          .from('expense_splits')
          .select('amount_owed')
          .eq('user_id', user.id)
          .in('expense_id', monthExpenseIds)
      : Promise.resolve({ data: [] }),
    supabase
      .from('expense_splits')
      .select('user_id, amount_owed, profile:profiles(id, display_name), expense:expenses!inner(paid_by, amount, household_id, paid_by_profile:profiles!paid_by(id, display_name))')
      .eq('expense.household_id', householdId)
      .eq('settled', false)
      .is('settlement_id', null),
    supabase
      .from('grocery_items')
      .select('id, name, quantity')
      .eq('household_id', householdId)
      .eq('checked_off', false)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('grocery_history')
      .select('name')
      .eq('household_id', householdId)
      .order('last_added_at', { ascending: false }),
    supabase
      .from('settlements')
      .select('id, created_at, status, expense_count, settlement_type, utility_category, created_by, created_by_profile:profiles!created_by(id, display_name), settlement_items(id, from_user_id, to_user_id, amount, paid_at, from_profile:profiles!from_user_id(id, display_name, avatar_color, avatar_initials), to_profile:profiles!to_user_id(id, display_name, avatar_color, avatar_initials)), linked_splits:expense_splits(expense:expenses!inner(expense_type, utility_category))')
      .eq('household_id', householdId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, display_name').eq('household_id', householdId),
    supabase.from('chores').select('id, title, slot_index').eq('household_id', householdId).order('slot_index'),
    supabase.from('chore_rotation_slots').select('slot_index, user_id, profile:profiles(id, display_name)').eq('household_id', householdId).order('slot_index'),
    supabase.from('chore_completions').select('chore_id, user_id, week_of').eq('week_of', weekOf)
      .in('chore_id', await supabase.from('chores').select('id').eq('household_id', householdId).then(r => (r.data ?? []).map((c: any) => c.id))),
  ])

  const unsettledSplits = splitsRes.data ?? []
  const expenseMap = new Map()
  for (const s of unsettledSplits) {
    const e = (s as any).expense
    if (e) expenseMap.set(e.paid_by + '_' + e.amount, e)
  }

  const balanceData = calculateBalances(
    unsettledSplits as any,
    Array.from(expenseMap.values())
  )

  const choreAssignments = getMonthlyAssignments(
    (choresRes.data ?? []) as any,
    (rotationRes.data ?? []) as any,
    household?.rotation_start_year ?? now.getFullYear(),
    household?.rotation_start_month ?? (now.getMonth() + 1),
    now.getFullYear(),
    now.getMonth() + 1
  )

  const totalSpentThisMonth = (mySpendRes.data ?? [])
    .reduce((s, e) => s + Number(e.amount_owed), 0)

  // Net from pending settlement items (covers both regular + utility settlements)
  const pendingSettlements = (settlementsRes.data ?? []) as any[]
  const settlementNet = pendingSettlements.reduce((net: number, s: any) => {
    for (const item of s.settlement_items ?? []) {
      if (item.paid_at) continue
      if (item.to_user_id === user.id) net += Number(item.amount)
      if (item.from_user_id === user.id) net -= Number(item.amount)
    }
    return net
  }, 0)

  // Regular new splits not yet in any settlement
  const regularNet = balanceData.balances.find(b => b.userId === user.id)?.net ?? 0
  const totalOwed = regularNet + settlementNet

  return (
    <DashboardContent
      displayName={profile.display_name}
      householdName={household?.name ?? ''}
      totalSpentThisMonth={totalSpentThisMonth}
      myBalance={totalOwed}
      balanceData={balanceData}
      householdId={householdId}
      choreAssignments={choreAssignments}
      choreCompletions={completionsRes.data ?? []}
      groceryItems={groceryRes.data ?? []}
      groceryHistory={(groceryHistoryRes.data ?? []) as { name: string }[]}
      pendingSettlements={(settlementsRes.data ?? []) as any[]}
      currentUserId={user.id}
      unsettledExpenseCount={expenseMap.size}
      members={membersRes.data ?? []}
    />
  )
}
