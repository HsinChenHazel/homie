export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import SettingsPanel from '@/components/SettingsPanel'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, household:households(*)')
    .eq('id', user.id)
    .single()

  const members = profile?.household_id
    ? (await supabase
        .from('profiles')
        .select('id, display_name')
        .eq('household_id', profile.household_id)
        .then(r => r.data ?? []))
    : []

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>Settings</h2>
      <SettingsPanel profile={profile} members={members} />
    </div>
  )
}
