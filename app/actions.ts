'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createFreshClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { calculateBalances } from '@/lib/balances'

export async function signUpAction(
  email: string,
  password: string,
  displayName: string
) {
  // Use a session-less client so no existing auth token is sent with the request
  const supabase = createFreshClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName } },
  })
  if (error) return { error: error.message }
  return { data }
}

export async function createHouseholdAction(name: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Generate the UUID here so we don't need to SELECT after INSERT
  // (the SELECT would fail RLS since profile.household_id is still null at that point)
  const householdId = crypto.randomUUID()

  const { error: insertError } = await supabase
    .from('households')
    .insert({ id: householdId, name })

  if (insertError) return { error: insertError.message }

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ household_id: householdId })
    .eq('id', user.id)

  if (profileError) return { error: `Household created but could not link profile: ${profileError.message}` }

  revalidatePath('/settings')
  revalidatePath('/dashboard')
  return { data: { id: householdId, name } }
}

export async function joinWithSignupAction(
  inviteCode: string,
  email: string,
  password: string,
  displayName: string
) {
  const supabase = createFreshClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // 1. Verify invite code via security-definer RPC (bypasses RLS for unauthenticated callers)
  const { data: households, error: rpcErr } = await supabase
    .rpc('lookup_household_by_invite', { code: inviteCode })

  if (rpcErr) return { error: `RPC error: ${rpcErr.message}` }
  const household = households?.[0]
  if (!household) return { error: 'Invalid invite code' }

  // 2. Sign up — pass household_id in metadata so the handle_new_user trigger sets it directly
  const { data: authData, error: signUpErr } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName, household_id: household.id } },
  })

  if (signUpErr || !authData.user) return { error: signUpErr?.message ?? 'Sign up failed' }

  return { data: { householdName: household.name } }
}

export async function joinHouseholdAction(inviteCode: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: h, error } = await supabase
    .from('households')
    .select('id, name')
    .eq('invite_code', inviteCode.trim().toLowerCase())
    .single()

  if (error || !h) return { error: 'Invalid invite code' }

  await supabase.from('profiles').update({ household_id: h.id }).eq('id', user.id)

  revalidatePath('/settings')
  revalidatePath('/dashboard')
  return { data: h }
}

export async function createSettlementAction(
  householdId: string,
  transactions: { fromId: string; toId: string; amount: number }[],
  expenseCount: number,
  cancelSettlementIds: string[] = []
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // 0. Cancel any existing pending settlements (unlink splits, then delete)
  if (cancelSettlementIds.length) {
    await supabase
      .from('expense_splits')
      .update({ settlement_id: null })
      .in('settlement_id', cancelSettlementIds)

    await supabase
      .from('settlements')
      .delete()
      .in('id', cancelSettlementIds)
  }

  // 1. Create settlement record
  const settlementId = crypto.randomUUID()
  const { error: settlErr } = await supabase
    .from('settlements')
    .insert({ id: settlementId, household_id: householdId, created_by: user.id, expense_count: expenseCount })

  if (settlErr) return { error: settlErr.message }

  // 2. Create one settlement_item per transaction
  const { error: itemsErr } = await supabase
    .from('settlement_items')
    .insert(transactions.map(t => ({
      settlement_id: settlementId,
      from_user_id: t.fromId,
      to_user_id: t.toId,
      amount: t.amount,
    })))

  if (itemsErr) return { error: itemsErr.message }

  // 3. Link all currently unsettled splits to this settlement (not locked yet)
  const { data: splits } = await supabase
    .from('expense_splits')
    .select('id, expense:expenses!inner(household_id)')
    .eq('expense.household_id', householdId)
    .eq('settled', false)
    .is('settlement_id', null)

  if (splits?.length) {
    await supabase
      .from('expense_splits')
      .update({ settlement_id: settlementId })
      .in('id', splits.map((s: any) => s.id))
  }

  revalidatePath('/expenses')
  revalidatePath('/dashboard')
  return { data: { id: settlementId } }
}

export async function createUtilityExpenseAction(
  householdId: string,
  title: string,
  amount: number,
  date: string,
  currency: string,
  utilityCategory: string,
  memberSplits: { userId: string; amountOwed: number }[]
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // 1. Create expense
  const { data: expense, error: expErr } = await supabase
    .from('expenses')
    .insert({
      household_id: householdId,
      paid_by: user.id,
      title,
      amount,
      date,
      currency,
      split_type: 'equal',
      expense_type: 'utility',
      utility_category: utilityCategory,
    })
    .select()
    .single()

  if (expErr || !expense) return { error: expErr?.message ?? 'Failed to create expense' }

  // 2. Create splits
  const { error: splitsErr } = await supabase.from('expense_splits').insert(
    memberSplits.map(s => ({ expense_id: expense.id, user_id: s.userId, amount_owed: s.amountOwed }))
  )
  if (splitsErr) return { error: splitsErr.message }

  // 3. Only create/merge settlement if there are other people to collect from
  const debtors = memberSplits.filter(s => s.userId !== user.id)

  if (debtors.length) {
    // Check for an existing pending settlement to merge into
    const { data: existingSettlement } = await supabase
      .from('settlements')
      .select('id, expense_count')
      .eq('household_id', householdId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    let settlementId: string

    if (existingSettlement) {
      // Merge into existing settlement
      settlementId = existingSettlement.id
      await supabase
        .from('settlements')
        .update({ expense_count: existingSettlement.expense_count + 1 })
        .eq('id', settlementId)

      // Add to existing item for the same from→to pair, or insert new
      for (const debtor of debtors) {
        const { data: existingItem } = await supabase
          .from('settlement_items')
          .select('id, amount')
          .eq('settlement_id', settlementId)
          .eq('from_user_id', debtor.userId)
          .eq('to_user_id', user.id)
          .is('paid_at', null)
          .maybeSingle()

        if (existingItem) {
          await supabase
            .from('settlement_items')
            .update({ amount: Number(existingItem.amount) + debtor.amountOwed })
            .eq('id', existingItem.id)
        } else {
          await supabase.from('settlement_items').insert({
            settlement_id: settlementId,
            from_user_id: debtor.userId,
            to_user_id: user.id,
            amount: debtor.amountOwed,
          })
        }
      }
    } else {
      // Create a new settlement
      settlementId = crypto.randomUUID()
      const { error: settlErr } = await supabase
        .from('settlements')
        .insert({
          id: settlementId,
          household_id: householdId,
          created_by: user.id,
          expense_count: 1,
          settlement_type: 'utility',
          utility_category: utilityCategory,
        })
      if (settlErr) return { error: settlErr.message }

      const { error: itemsErr } = await supabase.from('settlement_items').insert(
        debtors.map(s => ({
          settlement_id: settlementId,
          from_user_id: s.userId,
          to_user_id: user.id,
          amount: s.amountOwed,
        }))
      )
      if (itemsErr) return { error: itemsErr.message }
    }

    await supabase
      .from('expense_splits')
      .update({ settlement_id: settlementId })
      .eq('expense_id', expense.id)
  }

  revalidatePath('/expenses')
  revalidatePath('/dashboard')
  return { data: { id: 'done' } }
}

export async function markPaidAction(settlementItemId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Mark this item paid (only the debtor can do this)
  const { data: item, error: markErr } = await supabase
    .from('settlement_items')
    .update({ paid_at: new Date().toISOString() })
    .eq('id', settlementItemId)
    .eq('from_user_id', user.id)
    .select('settlement_id')
    .single()

  if (markErr || !item) return { error: 'Could not mark as paid' }

  // Check if all items in this settlement are now paid
  const { data: unpaid } = await supabase
    .from('settlement_items')
    .select('id')
    .eq('settlement_id', item.settlement_id)
    .is('paid_at', null)

  if (!unpaid?.length) {
    // Everyone paid — lock the expenses and complete the settlement
    await supabase
      .from('expense_splits')
      .update({ settled: true })
      .eq('settlement_id', item.settlement_id)

    await supabase
      .from('settlements')
      .update({ status: 'complete' })
      .eq('id', item.settlement_id)
  }

  revalidatePath('/expenses')
  revalidatePath('/dashboard')
  return { data: true }
}

export async function updateHouseholdCurrencyAction(householdId: string, currency: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('households')
    .update({ default_currency: currency })
    .eq('id', householdId)

  if (error) return { error: error.message }

  revalidatePath('/settings')
  revalidatePath('/expenses')
  return { data: true }
}

export async function saveRotationAction(
  householdId: string,
  memberOrder: string[], // user_ids in rotation order
  startYear: number,
  startMonth: number
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Delete existing slots and re-insert
  await supabase.from('chore_rotation_slots').delete().eq('household_id', householdId)

  const { error } = await supabase.from('chore_rotation_slots').insert(
    memberOrder.map((userId, i) => ({
      household_id: householdId,
      user_id: userId,
      slot_index: i,
    }))
  )
  if (error) return { error: error.message }

  await supabase
    .from('households')
    .update({ rotation_start_year: startYear, rotation_start_month: startMonth })
    .eq('id', householdId)

  revalidatePath('/chores')
  return { data: true }
}

export async function saveChoreSlotIndexesAction(chores: { id: string; slot_index: number }[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  await Promise.all(
    chores.map(c =>
      supabase.from('chores').update({ slot_index: c.slot_index }).eq('id', c.id)
    )
  )
  revalidatePath('/chores')
  return { data: true }
}

export async function markChoreCompleteAction(choreId: string, weekOf: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('chore_completions')
    .upsert({ chore_id: choreId, user_id: user.id, week_of: weekOf })

  if (error) return { error: error.message }
  revalidatePath('/chores')
  revalidatePath('/dashboard')
  return { data: true }
}

export async function undoChoreCompleteAction(choreId: string, weekOf: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  await supabase
    .from('chore_completions')
    .delete()
    .eq('chore_id', choreId)
    .eq('user_id', user.id)
    .eq('week_of', weekOf)

  revalidatePath('/chores')
  revalidatePath('/dashboard')
  return { data: true }
}

export async function updateAvatarAction(color: string, initials: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('profiles')
    .update({ avatar_color: color, avatar_initials: initials || null })
    .eq('id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/settings')
  return { data: true }
}

export async function updateDisplayNameAction(displayName: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('profiles')
    .update({ display_name: displayName })
    .eq('id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/settings')
  revalidatePath('/dashboard')
  return { data: true }
}

export async function deleteExpenseAction(expenseId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Capture settlement IDs before cascade-delete removes the splits
  const { data: preSplits } = await supabase
    .from('expense_splits')
    .select('settlement_id')
    .eq('expense_id', expenseId)
    .not('settlement_id', 'is', null)

  const settlementIds = [...new Set((preSplits ?? []).map((s: any) => s.settlement_id as string))]

  const { error: delErr } = await supabase.from('expenses').delete().eq('id', expenseId)
  if (delErr) return { error: delErr.message }

  for (const settlementId of settlementIds) {
    const { data: remainingSplits } = await supabase
      .from('expense_splits')
      .select('user_id, amount_owed, profile:profiles!user_id(id, display_name), expense:expenses(id, paid_by, amount, paid_by_profile:profiles!paid_by(id, display_name))')
      .eq('settlement_id', settlementId)
      .eq('settled', false)

    if (!remainingSplits?.length) {
      await supabase.from('settlements').delete().eq('id', settlementId)
      continue
    }

    const expenseMap = new Map<string, any>()
    for (const s of remainingSplits) {
      const e = s.expense as any
      if (e?.id && !expenseMap.has(e.id)) expenseMap.set(e.id, e)
    }

    const { transactions } = calculateBalances(remainingSplits as any, Array.from(expenseMap.values()))

    await supabase.from('settlement_items').delete().eq('settlement_id', settlementId)

    if (transactions.length) {
      await supabase.from('settlement_items').insert(
        transactions.map(t => ({
          settlement_id: settlementId,
          from_user_id: t.fromId,
          to_user_id: t.toId,
          amount: t.amount,
        }))
      )
    }

    await supabase.from('settlements').update({ expense_count: expenseMap.size }).eq('id', settlementId)
  }

  revalidatePath('/expenses')
  revalidatePath('/dashboard')
  return { data: true }
}
