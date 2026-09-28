export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardContent from '@/components/DashboardContent'
import NoHousehold from '@/components/NoHousehold'
import { calculateBalances } from '@/lib/balances'
import { getAllGroupAssignments, getWeekStart } from '@/lib/chores'

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

  const [splitsRes, settlementsRes, membersRes, groupsRes, completionsRes, notesRes] = await Promise.all([
    supabase
      .from('expense_splits')
      .select('user_id, amount_owed, profile:profiles(id, display_name), expense:expenses!inner(paid_by, amount, household_id, paid_by_profile:profiles!paid_by(id, display_name))')
      .eq('expense.household_id', householdId)
      .eq('settled', false)
      .is('settlement_id', null),
    supabase
      .from('settlements')
      .select('id, created_at, status, expense_count, settlement_type, utility_category, created_by, created_by_profile:profiles!created_by(id, display_name), settlement_items(id, from_user_id, to_user_id, amount, paid_at, from_profile:profiles!from_user_id(id, display_name, avatar_color, avatar_initials), to_profile:profiles!to_user_id(id, display_name, avatar_color, avatar_initials)), linked_splits:expense_splits(expense:expenses!inner(expense_type, utility_category))')
      .eq('household_id', householdId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, display_name').eq('household_id', householdId),
    supabase
      .from('chore_groups')
      .select('id, name, rotation_start_year, rotation_start_month, chores(id, title, slot_index), chore_group_members(user_id, slot_index, profile:profiles(id, display_name))')
      .eq('household_id', householdId)
      .order('created_at'),
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

  const choreAssignments = getAllGroupAssignments(
    (groupsRes.data ?? []) as any,
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
      pendingSettlements={(settlementsRes.data ?? []) as any[]}
      currentUserId={user.id}
      unsettledExpenseCount={expenseMap.size}
      members={membersRes.data ?? []}
      defaultCurrency={household?.default_currency ?? 'USD'}
      notes={(notesRes.data ?? []) as any[]}
    />
  )
}
