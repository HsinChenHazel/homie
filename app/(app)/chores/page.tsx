export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ChoreBoard from '@/components/chores/ChoreBoard'
import { getWeeksInMonth } from '@/lib/chores'

export default async function ChoresPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('household_id')
    .eq('id', user.id)
    .single()

  const householdId = profile?.household_id
  const now = new Date()
  const monthWeeks = getWeeksInMonth(now.getFullYear(), now.getMonth() + 1)

  const [groupsRes, choresRes, completionsRes, membersRes] = await Promise.all([
    householdId
      ? supabase
          .from('chore_groups')
          .select('id, name, rotation_start_year, rotation_start_month, chores(id, title, slot_index), chore_group_members(user_id, slot_index, profile:profiles(id, display_name))')
          .eq('household_id', householdId)
          .order('created_at')
      : { data: [] },
    // All chores in household (for Manage tab — includes ungrouped)
    householdId
      ? supabase.from('chores').select('id, title, slot_index, group_id').eq('household_id', householdId)
      : { data: [] },
    householdId
      ? supabase
          .from('chore_completions')
          .select('chore_id, user_id, week_of')
          .in('week_of', monthWeeks)
          .in(
            'chore_id',
            await supabase.from('chores').select('id').eq('household_id', householdId)
              .then(r => (r.data ?? []).map((c: any) => c.id))
          )
      : { data: [] },
    householdId
      ? supabase.from('profiles').select('id, display_name, avatar_color').eq('household_id', householdId)
      : { data: [] },
  ])

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>Chore Roster</h2>
      <ChoreBoard
        groups={(groupsRes.data ?? []) as any}
        allChores={(choresRes.data ?? []) as any}
        completions={completionsRes.data ?? []}
        members={(membersRes.data ?? []) as any}
        currentUserId={user.id}
        householdId={householdId ?? null}
      />
    </div>
  )
}
