import type { DaySlot, Holiday } from '../types'

/** Return the ISO date string of every Friday between start and end (inclusive). */
export function getWeekendFridays(start: string, end: string): string[] {
  const fridays: string[] = []
  const d = new Date(start + 'T00:00:00')
  const endDate = new Date(end + 'T00:00:00')

  // Advance to first Friday (getDay() === 5)
  while (d.getDay() !== 5) d.setDate(d.getDate() + 1)

  while (d <= endDate) {
    fridays.push(toISO(d))
    d.setDate(d.getDate() + 7)
  }
  return fridays
}

/** Return ISO date strings for Fri/Sat/Sun of a given weekend. */
export function getWeekendDates(fridayISO: string): Record<DaySlot, string> {
  const fri = new Date(fridayISO + 'T00:00:00')
  const sat = new Date(fri); sat.setDate(fri.getDate() + 1)
  const sun = new Date(fri); sun.setDate(fri.getDate() + 2)
  return { friday: fridayISO, saturday: toISO(sat), sunday: toISO(sun) }
}

/** Find the holiday that contains the given ISO date, or null. */
export function findHoliday(date: string, holidays: Holiday[]): Holiday | null {
  return holidays.find(h => date >= h.startDate && date <= h.endDate) ?? null
}

/** True if ALL days of the weekend (Fri/Sat/Sun) fall inside any holiday. */
export function isWeekendFullyInHoliday(fridayISO: string, holidays: Holiday[]): boolean {
  const { friday, saturday, sunday } = getWeekendDates(fridayISO)
  return [friday, saturday, sunday].every(d => findHoliday(d, holidays) !== null)
}

/** Short display: "14 okt" */
export function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('nl-BE', {
    day: 'numeric',
    month: 'short',
  })
}

/** Weekend label: "14–16 nov" */
export function fmtWeekend(fridayISO: string): string {
  const { friday, sunday } = getWeekendDates(fridayISO)
  const fri = new Date(friday + 'T00:00:00')
  const sun = new Date(sunday + 'T00:00:00')
  const sameMonth = fri.getMonth() === sun.getMonth()
  const friStr = fri.toLocaleDateString('nl-BE', { day: 'numeric', month: sameMonth ? undefined : 'short' })
  const sunStr = sun.toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' })
  return `${friStr}–${sunStr}`
}

/** ISO string from Date (date part only). */
function toISO(d: Date): string {
  return d.toISOString().slice(0, 10)
}
