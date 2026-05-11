export type MemberBalance = {
  userId: string
  name: string
  net: number // positive = is owed money, negative = owes money
}

export type Transaction = {
  fromId: string
  fromName: string
  toId: string
  toName: string
  amount: number
}

export type BalanceData = {
  balances: MemberBalance[]
  transactions: Transaction[]
  totalUnsettled: number
}

/**
 * Given a list of unsettled expense_splits with payer info,
 * calculate net balances and minimum transactions to settle up.
 */
export function calculateBalances(
  splits: { user_id: string; amount_owed: number; profile: { id: string; display_name: string } | null }[],
  expenses: { paid_by: string; amount: number; paid_by_profile: { id: string; display_name: string } | null }[]
): BalanceData {
  const netMap: Record<string, { name: string; net: number }> = {}

  // Each payer gets credited the full amount they paid
  for (const expense of expenses) {
    const id = expense.paid_by
    const name = expense.paid_by_profile?.display_name ?? 'Unknown'
    if (!netMap[id]) netMap[id] = { name, net: 0 }
    netMap[id].net += Number(expense.amount)
  }

  // Each person in a split is debited their share
  for (const split of splits) {
    const id = split.user_id
    const name = split.profile?.display_name ?? 'Unknown'
    if (!netMap[id]) netMap[id] = { name, net: 0 }
    netMap[id].net -= Number(split.amount_owed)
  }

  const balances: MemberBalance[] = Object.entries(netMap).map(([userId, { name, net }]) => ({
    userId,
    name,
    net: parseFloat(net.toFixed(2)),
  }))

  const totalUnsettled = splits.reduce((s, sp) => s + Number(sp.amount_owed), 0)

  // Minimum transactions algorithm (greedy)
  const creditors = balances
    .filter(b => b.net > 0.01)
    .map(b => ({ ...b }))
    .sort((a, b) => b.net - a.net)

  const debtors = balances
    .filter(b => b.net < -0.01)
    .map(b => ({ ...b }))
    .sort((a, b) => a.net - b.net)

  const transactions: Transaction[] = []
  let ci = 0
  let di = 0

  while (ci < creditors.length && di < debtors.length) {
    const amount = Math.min(creditors[ci].net, -debtors[di].net)
    transactions.push({
      fromId: debtors[di].userId,
      fromName: debtors[di].name,
      toId: creditors[ci].userId,
      toName: creditors[ci].name,
      amount: parseFloat(amount.toFixed(2)),
    })
    creditors[ci].net -= amount
    debtors[di].net += amount
    if (creditors[ci].net < 0.01) ci++
    if (debtors[di].net > -0.01) di++
  }

  return { balances, transactions, totalUnsettled }
}
