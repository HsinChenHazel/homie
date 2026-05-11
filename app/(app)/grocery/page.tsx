export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import GroceryList from '@/components/grocery/GroceryList'

export default async function GroceryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('household_id, household:households(default_currency)')
    .eq('id', user.id)
    .single()

  const householdId = profile?.household_id
  const defaultCurrency = await (householdId
    ? supabase.from('households').select('default_currency').eq('id', householdId).single()
        .then(r => (r.data as any)?.default_currency ?? 'USD').catch(() => 'USD')
    : Promise.resolve('USD'))

  const [itemsRes, membersRes, historyRes] = await Promise.all([
    householdId
      ? supabase
          .from('grocery_items')
          .select('*, added_by_profile:profiles!added_by(id, display_name)')
          .eq('household_id', householdId)
          .order('checked_off', { ascending: true })
          .order('created_at', { ascending: false })
      : { data: [] },
    householdId
      ? supabase.from('profiles').select('id, display_name').eq('household_id', householdId)
      : { data: [] },
    householdId
      ? supabase
          .from('grocery_history')
          .select('name')
          .eq('household_id', householdId)
          .order('last_added_at', { ascending: false })
      : { data: [] },
  ])

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>Grocery List</h2>
      <GroceryList
        items={itemsRes.data ?? []}
        history={(historyRes.data ?? []) as { name: string }[]}
        currentUserId={user.id}
        householdId={householdId ?? null}
        members={membersRes.data ?? []}
        defaultCurrency={defaultCurrency}
      />
    </div>
  )
}
