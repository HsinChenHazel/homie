export type RotationSlot = {
  slot_index: number
  user_id: string
  profile: { id: string; display_name: string } | null
}

export type ChoreWithSlot = {
  id: string
  title: string
  slot_index: number
}

export type ChoreAssignee = {
  user_id: string
  slot_index: number
  profile: { id: string; display_name: string } | null
}

export type ChoreWithAssignees = {
  id: string
  title: string
  chore_assignees: ChoreAssignee[]
}

export type MonthlyAssignment = {
  chore: ChoreWithSlot
  userId: string
  displayName: string
}

/** Returns all Monday dates (YYYY-MM-DD) for weeks that overlap the given month */
export function getWeeksInMonth(year: number, month: number): string[] {
  const weeks: string[] = []
  const lastDay = new Date(year, month, 0)
  const first = new Date(year, month - 1, 1)
  const dow = first.getDay()
  first.setDate(first.getDate() + (dow === 0 ? -6 : 1 - dow))
  let cur = new Date(first)
  while (cur <= lastDay) {
    const y = cur.getFullYear()
    const m = String(cur.getMonth() + 1).padStart(2, '0')
    const d = String(cur.getDate()).padStart(2, '0')
    weeks.push(`${y}-${m}-${d}`)
    cur.setDate(cur.getDate() + 7)
  }
  return weeks
}

/** Returns the Monday of the week containing `date` as a YYYY-MM-DD string */
export function getWeekStart(date = new Date()): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().slice(0, 10)
}

export function getMonthlyAssignmentsV2(
  chores: ChoreWithAssignees[],
  startYear: number,
  startMonth: number,
  targetYear: number,
  targetMonth: number
): MonthlyAssignment[] {
  const monthOffset = (targetYear * 12 + targetMonth) - (startYear * 12 + startMonth)

  return chores.flatMap(chore => {
    const validAssignees = [...chore.chore_assignees]
      .filter(a => a.profile !== null)
      .sort((a, b) => a.slot_index - b.slot_index)

    if (!validAssignees.length) return []

    const n = validAssignees.length
    const personIndex = ((monthOffset % n) + n) % n
    const assignee = validAssignees[personIndex]

    return [{
      chore: { id: chore.id, title: chore.title, slot_index: 0 },
      userId: assignee.user_id,
      displayName: assignee.profile!.display_name,
    }]
  })
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
  const validSlots = slots.filter(s => s.profile !== null)
  if (!validSlots.length || !chores.length) return []

  const monthOffset =
    (targetYear * 12 + targetMonth) - (startYear * 12 + startMonth)
  const n = validSlots.length

  const sortedChores = [...chores].sort((a, b) => a.slot_index - b.slot_index)
  const sortedSlots = [...validSlots].sort((a, b) => a.slot_index - b.slot_index)

  return sortedChores.map((chore, i) => {
    const personIndex = ((i + monthOffset) % n + n) % n
    const slot = sortedSlots[personIndex]
    return {
      chore,
      userId: slot.user_id,
      displayName: slot.profile!.display_name,
    }
  })
}
