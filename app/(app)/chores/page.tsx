export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ChoreBoard from '@/components/chores/ChoreBoard'
import { getWeekStart } from '@/lib/chores'

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
  const weekOf = getWeekStart()

  const [choresRes, rotationRes, completionsRes, membersRes] = await Promise.all([
    householdId
      ? supabase
          .from('chores')
          .select('id, title, slot_index')
          .eq('household_id', householdId)
          .order('slot_index')
      : { data: [] },
    householdId
      ? supabase
          .from('chore_rotation_slots')
          .select('slot_index, user_id, profile:profiles(id, display_name)')
          .eq('household_id', householdId)
          .order('slot_index')
      : { data: [] },
    householdId
      ? supabase
          .from('chore_completions')
          .select('chore_id, user_id, week_of')
          .eq('week_of', weekOf)
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
        rotationSlots={(rotationRes.data ?? []) as any}
        completions={completionsRes.data ?? []}
        members={membersRes.data ?? []}
        currentUserId={user.id}
        householdId={householdId ?? null}
        household={household}
      />
    </div>
  )
}
