export type RotationSlot = {
  slot_index: number
  user_id: string
  profile: { id: string; display_name: string }
}

export type ChoreWithSlot = {
  id: string
  title: string
  slot_index: number
}

export type MonthlyAssignment = {
  chore: ChoreWithSlot
  userId: string
  displayName: string
}

/** Returns the Monday of the week containing `date` as a YYYY-MM-DD string */
export function getWeekStart(date = new Date()): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().slice(0, 10)
}

/**
 * Returns who does each chore for a given month.
 * Formula: for chore at index C, person = slots[(C + monthOffset) % n]
 */
export function getMonthlyAssignments(
  chores: ChoreWithSlot[],
  slots: RotationSlot[],
  startYear: number,
  startMonth: number,
  targetYear: number,
  targetMonth: number
): MonthlyAssignment[] {
  if (!slots.length || !chores.length) return []

  const monthOffset =
    (targetYear * 12 + targetMonth) - (startYear * 12 + startMonth)
  const n = slots.length

  const sortedChores = [...chores].sort((a, b) => a.slot_index - b.slot_index)
  const sortedSlots = [...slots].sort((a, b) => a.slot_index - b.slot_index)

  return sortedChores.map((chore, i) => {
    const personIndex = ((i + monthOffset) % n + n) % n
    const slot = sortedSlots[personIndex]
    return {
      chore,
      userId: slot.user_id,
      displayName: slot.profile.display_name,
    }
  })
}
