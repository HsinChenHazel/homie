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
    .select('household_id, household:households(id, rotation_start_year, rotation_start_month)')
    .eq('id', user.id)
    .single()

  const householdId = profile?.household_id
  const household = (profile?.household as any) ?? null
  const now = new Date()
  const monthWeeks = getWeeksInMonth(now.getFullYear(), now.getMonth() + 1)

  const [choresRes, completionsRes, membersRes] = await Promise.all([
    householdId
      ? supabase
          .from('chores')
          .select('id, title, chore_assignees(user_id, slot_index, profile:profiles(id, display_name))')
          .eq('household_id', householdId)
          .order('created_at')
      : { data: [] },
    householdId
      ? supabase
          .from('chore_completions')
          .select('chore_id, user_id, week_of')
          .in('week_of', monthWeeks)
          .in(
            'chore_id',
            await supabase
              .from('chores')
              .select('id')
              .eq('household_id', householdId)
              .then(r => (r.data ?? []).map((c: any) => c.id))
          )
      : { data: [] },
    householdId
      ? supabase.from('profiles').select('id, display_name').eq('household_id', householdId)
      : { data: [] },
  ])

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>Chore Roster</h2>
      <ChoreBoard
        chores={(choresRes.data ?? []) as any}
        completions={completionsRes.data ?? []}
        members={membersRes.data ?? []}
        currentUserId={user.id}
        householdId={householdId ?? null}
        household={household}
      />
    </div>
  )
}
