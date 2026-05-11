export type Household = {
  id: string
  name: string
  invite_code: string
  created_at: string
}

export type Profile = {
  id: string
  display_name: string
  household_id: string | null
  created_at: string
}

export type Expense = {
  id: string
  household_id: string
  paid_by: string
  title: string
  amount: number
  date: string
  split_type: 'equal' | 'custom'
  created_at: string
  // joined
  paid_by_profile?: Profile
  splits?: ExpenseSplit[]
}

export type ExpenseSplit = {
  id: string
  expense_id: string
  user_id: string
  amount_owed: number
  settled: boolean
  profile?: Profile
}

export type Chore = {
  id: string
  household_id: string
  title: string
  recurrence: 'daily' | 'weekly' | 'none'
  created_at: string
}

export type ChoreAssignment = {
  id: string
  chore_id: string
  user_id: string
  due_date: string
  completed: boolean
  chore?: Chore
  profile?: Profile
}

export type GroceryItem = {
  id: string
  household_id: string
  name: string
  quantity: string | null
  added_by: string
  checked_off: boolean
  created_at: string
  added_by_profile?: Profile
}
