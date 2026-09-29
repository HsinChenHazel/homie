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

  const [splitsRes, allSplitsRes, settlementsRes, membersRes, choresRes, rotationRes, completionsRes, notesRes] = await Promise.all([
    supabase
      .from('expense_splits')
      .select('user_id, amount_owed, profile:profiles(id, display_name), expense:expenses!inner(paid_by, amount, household_id, paid_by_profile:profiles!paid_by(id, display_name))')
      .eq('expense.household_id', householdId)
      .eq('settled', false)
      .is('settlement_id', null),
    supabase
      .from('expense_splits')
      .select('user_id, amount_owed, profile:profiles(id, display_name), expense:expenses!inner(paid_by, amount, household_id, paid_by_profile:profiles!paid_by(id, display_name))')
      .eq('expense.household_id', householdId)
      .eq('settled', false),
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
    supabase
      .from('household_notes')
      .select('id, content, created_at, user_id, profile:profiles(display_name, avatar_color, avatar_initials)')
      .eq('household_id', householdId)
      .order('created_at', { ascending: false })
      .limit(30),
  ])

  const unsettledSplits = splitsRes.data ?? []
  const expenseMap = new Map()
  for (const s of unsettledSplits) {
    const e = (s as any).expense
    if (e) expenseMap.set(e.paid_by + '_' + e.amount, e)
  }

  const balanceData = calculateBalances(unsettledSplits as any, Array.from(expenseMap.values()))

  const allSplits = allSplitsRes.data ?? []
  const allExpenseMap = new Map()
  for (const s of allSplits) {
    const e = (s as any).expense
    if (e) allExpenseMap.set(e.paid_by + '_' + e.amount, e)
  }
  const mergedBalanceData = calculateBalances(allSplits as any, Array.from(allExpenseMap.values()))

  const pendingSettlements = (settlementsRes.data ?? []) as any[]
  const pendingSettlementItems = pendingSettlements.flatMap((s: any) =>
    (s.settlement_items ?? [])
      .filter((item: any) => !item.paid_at)
      .map((item: any) => ({
        fromName: item.from_profile?.display_name ?? '',
        toName: item.to_profile?.display_name ?? '',
        amount: item.amount,
      }))
  )

  const choreAssignments = getMonthlyAssignments(
    (choresRes.data ?? []) as any,
    (rotationRes.data ?? []) as any,
    household?.rotation_start_year ?? now.getFullYear(),
    household?.rotation_start_month ?? (now.getMonth() + 1),
    now.getFullYear(),
    now.getMonth() + 1
  )

  return (
    <DashboardContent
      displayName={profile.display_name}
      householdName={household?.name ?? ''}
      balanceData={balanceData}
      householdId={householdId}
      choreAssignments={choreAssignments}
      choreCompletions={completionsRes.data ?? []}
      pendingSettlements={pendingSettlements}
      pendingSettlementIds={pendingSettlements.map((s: any) => s.id)}
      pendingSettlementItems={pendingSettlementItems}
      mergedBalanceData={mergedBalanceData}
      currentUserId={user.id}
      unsettledExpenseCount={expenseMap.size}
      members={membersRes.data ?? []}
      defaultCurrency={household?.default_currency ?? 'USD'}
      notes={(notesRes.data ?? []) as any[]}
    />
  )
}
