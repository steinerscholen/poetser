/**
 * Cleaning schedule algorithm — two weight methods
 *
 * METHOD 'inverse'  (default)
 *   weight = 1 / kids
 *   → 1-kind parent cleans the most, 4-kids parent the least
 *   → more kids in school = proportionally fewer total duties
 *
 * METHOD 'per-student'
 *   weight = kids
 *   → every family does the same number of SESSIONS (≈ 1.6/year)
 *   → a 3-kids family cleans 3 classrooms per session; 1-kid cleans 1
 *   → total class-visits: proportional to kids
 *
 * Both methods use a single GLOBAL debt counter per parent (not per class).
 * Compaction: parents already scheduled this weekend get a 0.5 priority bonus
 * so multi-class duties cluster on the same day.
 */

import type { AppData, Assignment, DaySlot, WeightMethod } from './types'
import { getWeekendFridays, getWeekendDates, findHoliday } from './utils/dates'

// ─── Resolve active weekends ──────────────────────────────────────────────────

export interface ResolvedWeekend {
  fridayDate: string
  availableDays: DaySlot[]
  forcedDay?: DaySlot
  isHoliday: boolean
  holidayName?: string
  skipped: boolean
}

export function resolveWeekends(data: AppData): ResolvedWeekend[] {
  const fridays = getWeekendFridays(data.schoolYear.start, data.schoolYear.end)

  return fridays.map((friday) => {
    const override = data.weekendOverrides.find((o) => o.fridayDate === friday)
    const dates = getWeekendDates(friday)

    const holidayForAnyDay =
      [dates.friday, dates.saturday, dates.sunday]
        .map((d) => findHoliday(d, data.holidays))
        .find(Boolean) ?? null

    let availableDays: DaySlot[]
    if (override) {
      availableDays = override.availableDays
    } else {
      const defaults = data.defaultAvailableDays.length
        ? data.defaultAvailableDays
        : (['saturday'] as DaySlot[])
      availableDays = defaults.filter((day) => !findHoliday(dates[day], data.holidays))
    }

    return {
      fridayDate: friday,
      availableDays,
      forcedDay: override?.forcedDay,
      isHoliday: !!holidayForAnyDay,
      holidayName: holidayForAnyDay?.name,
      skipped: availableDays.length === 0,
    }
  })
}

// ─── Weight helpers ───────────────────────────────────────────────────────────

function parentWeight(kids: number, method: WeightMethod): number {
  if (kids === 0) return 0
  return method === 'inverse' ? 1 / kids : kids
}

/**
 * Compute global target assignments per parent for a given method.
 * target[p] = weight[p] × K   where K = totalSlots / sumWeights
 */
export function computeTargets(
  parents: AppData['parents'],
  totalSlots: number,
  method: WeightMethod,
): Map<string, number> {
  const weights = new Map(parents.map((p) => [p.id, parentWeight(p.kids.length, method)]))
  const sumWeights = [...weights.values()].reduce((s, w) => s + w, 0)
  const K = sumWeights > 0 ? totalSlots / sumWeights : 0
  return new Map(parents.map((p) => [p.id, (weights.get(p.id) ?? 0) * K]))
}

// ─── Comparison helper (for the "Bereken" UI) ─────────────────────────────────

export interface MethodComparison {
  method: WeightMethod
  /** Expected targets grouped by kid count. */
  byKidCount: {
    kids: number
    familyCount: number
    target: number                  // expected total assignments (poetsklassen)
    schoolVisitsIfCompacted: number // target / kids = schoolbezoeken bij perfecte compactie
  }[]
}

export function compareMethodTargets(
  data: AppData,
  activeWeekendCount: number,
): MethodComparison[] {
  const { parents, classes } = data
  const totalSlots = activeWeekendCount * classes.length

  return (['inverse', 'per-student'] as WeightMethod[]).map((method) => {
    const targets = computeTargets(parents, totalSlots, method)

    // Group by kid count
    const groups = new Map<number, { count: number; totalTarget: number }>()
    for (const p of parents) {
      const k = p.kids.length
      if (k === 0) continue
      const existing = groups.get(k) ?? { count: 0, totalTarget: 0 }
      groups.set(k, {
        count: existing.count + 1,
        totalTarget: existing.totalTarget + (targets.get(p.id) ?? 0),
      })
    }

    return {
      method,
      byKidCount: [...groups.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([kids, { count, totalTarget }]) => ({
          kids,
          familyCount: count,
          target: count > 0 ? totalTarget / count : 0,
          schoolVisitsIfCompacted: count > 0 ? totalTarget / count / kids : 0,
        })),
    }
  })
}

// ─── Main scheduler ───────────────────────────────────────────────────────────

export function generateSchedule(
  data: AppData,
  method: WeightMethod = 'inverse',
): Assignment[] {
  const { classes, parents } = data
  const activeWeekends = resolveWeekends(data).filter((w) => !w.skipped)

  if (!activeWeekends.length || !classes.length || !parents.length) return []

  const totalSlots = activeWeekends.length * classes.length
  const globalTarget = computeTargets(parents, totalSlots, method)
  const globalActual = new Map(parents.map((p) => [p.id, 0]))

  const result: Assignment[] = []

  // parentDayOnWeekend[friday][parentId] = day chosen this weekend
  const parentDayOnWeekend = new Map<string, Map<string, DaySlot>>()
  for (const w of activeWeekends) {
    parentDayOnWeekend.set(w.fridayDate, new Map())
  }

  for (const weekend of activeWeekends) {
    const pdMap = parentDayOnWeekend.get(weekend.fridayDate)!

    for (const cls of classes) {
      const eligible = parents.filter((p) => p.kids.some((k) => k.classId === cls.id))
      if (!eligible.length) continue

      const scored = eligible.map((p) => ({
        parent: p,
        score:
          (globalTarget.get(p.id) ?? 0) -
          (globalActual.get(p.id) ?? 0) +
          (pdMap.has(p.id) ? 0.5 : 0),
      }))

      scored.sort((a, b) => b.score - a.score)
      const chosen = scored[0].parent

      let day: DaySlot
      if (pdMap.has(chosen.id)) {
        day = pdMap.get(chosen.id)!
      } else if (weekend.forcedDay && weekend.availableDays.includes(weekend.forcedDay)) {
        day = weekend.forcedDay
      } else {
        day = weekend.availableDays[0]
      }

      pdMap.set(chosen.id, day)
      globalActual.set(chosen.id, (globalActual.get(chosen.id) ?? 0) + 1)

      const kid = chosen.kids.find((k) => k.classId === cls.id)!
      result.push({
        weekendFriday: weekend.fridayDate,
        classId: cls.id,
        parentId: chosen.id,
        kidId: kid.id,
        day,
      })
    }
  }

  return result
}

// ─── Per-parent stats ─────────────────────────────────────────────────────────

export interface ParentStats {
  parentId: string
  parentName: string
  totalKids: number
  target: number
  assignmentCount: number
  deviation: number
  classes: { className: string; count: number }[]
  compactedWeekends: number
}

export function computeStats(
  data: AppData,
  activeWeekendCount: number,
  method: WeightMethod = 'inverse',
): ParentStats[] {
  const { parents, classes, assignments } = data
  const classMap = new Map(classes.map((c) => [c.id, c]))
  const totalSlots = activeWeekendCount * classes.length
  const targets = computeTargets(parents, totalSlots, method)

  return parents.map((p) => {
    const target = targets.get(p.id) ?? 0
    const myAssignments = assignments.filter((a) => a.parentId === p.id)

    const byWeekend = new Map<string, number>()
    for (const a of myAssignments) {
      byWeekend.set(a.weekendFriday, (byWeekend.get(a.weekendFriday) ?? 0) + 1)
    }
    const compactedWeekends = [...byWeekend.values()].filter((n) => n >= 2).length

    const classCount = new Map<string, number>()
    for (const a of myAssignments) {
      classCount.set(a.classId, (classCount.get(a.classId) ?? 0) + 1)
    }

    return {
      parentId: p.id,
      parentName: p.name,
      totalKids: p.kids.length,
      target,
      assignmentCount: myAssignments.length,
      deviation: myAssignments.length - target,
      classes: [...classCount.entries()].map(([cid, count]) => ({
        className: classMap.get(cid)?.name ?? '?',
        count,
      })),
      compactedWeekends,
    }
  })
}
