/**
 * Cleaning schedule algorithm — two weight methods, with partial-year eligibility.
 *
 * METHOD 'inverse'
 *   weight = 1 / kids  → 1-kind cleans the most, 4-kids the least
 *
 * METHOD 'per-student'
 *   weight = kids  → every family makes the same number of school visits
 *
 * ELIGIBILITY
 *   A kid (and their parent) is only eligible to clean a class on weekend W if:
 *     kid.activeFrom  === undefined  OR  W.fridayDate >= kid.activeFrom
 *     kid.activeTo    === undefined  OR  W.fridayDate <  kid.activeTo
 *
 *   This supports:
 *   • Peuters joining mid-year      → kid.activeFrom = first day back after break
 *   • Peuter→Kleuter transitions    → peuterklas kid gets activeTo,
 *                                     kleuterklas kid gets activeFrom (same date)
 *
 * TARGETS
 *   Adjusted per parent: a parent eligible for only half the weekends gets a
 *   proportionally lower target so they aren't over-assigned when they do join.
 *
 * COMPACTION
 *   Parents already scheduled this weekend get a +0.5 priority bonus so
 *   multi-class duties cluster on the same day.
 */

import type { AppData, Assignment, DaySlot, Kid, WeightMethod } from './types'
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

// ─── Eligibility ──────────────────────────────────────────────────────────────

/** Is a specific kid active (eligible to clean their class) on this weekend? */
export function isKidActiveOn(kid: Kid, fridayDate: string): boolean {
  if (kid.activeFrom && fridayDate < kid.activeFrom) return false
  if (kid.activeTo   && fridayDate >= kid.activeTo)  return false
  return true
}

/** Is a parent eligible to clean class `classId` on this weekend? */
function isEligibleFor(
  parent: AppData['parents'][0],
  classId: string,
  fridayDate: string,
): boolean {
  return parent.kids.some((k) => k.classId === classId && isKidActiveOn(k, fridayDate))
}

// ─── Weight + target helpers ──────────────────────────────────────────────────

function parentWeight(kids: number, method: WeightMethod): number {
  if (kids === 0) return 0
  return method === 'inverse' ? 1 / kids : kids
}

/**
 * Compute adjusted global target per parent.
 *
 * A parent eligible for only E of the W active weekends gets a target scaled
 * by E/W relative to a full-year parent — preventing them from "catching up"
 * unfairly when they eventually become eligible.
 *
 * target[p] = baseWeight[p] × (eligibleWeekends[p] / totalWeekends) × K
 * where K = totalSlots / Σ adjustedWeights
 */
export function computeTargets(
  parents: AppData['parents'],
  activeWeekends: ResolvedWeekend[],
  classes: AppData['classes'],
  method: WeightMethod,
): Map<string, number> {
  const totalW = activeWeekends.length
  const totalSlots = totalW * classes.length

  // Adjusted weight: base weight × fraction of weekends where parent has
  // at least one active kid in some class.
  const adjWeights = new Map<string, number>()
  for (const p of parents) {
    const baseW = parentWeight(p.kids.length, method)
    const eligibleW = activeWeekends.filter((w) =>
      p.kids.some((k) =>
        isKidActiveOn(k, w.fridayDate) &&
        classes.some((c) => c.id === k.classId)
      )
    ).length
    adjWeights.set(p.id, totalW > 0 ? baseW * (eligibleW / totalW) : 0)
  }

  const sumAdj = [...adjWeights.values()].reduce((s, w) => s + w, 0)
  const K = sumAdj > 0 ? totalSlots / sumAdj : 0

  return new Map(parents.map((p) => [p.id, (adjWeights.get(p.id) ?? 0) * K]))
}

// ─── Comparison helper (for the "Bereken" UI) ─────────────────────────────────

export interface MethodComparison {
  method: WeightMethod
  byKidCount: {
    kids: number
    familyCount: number
    target: number
    schoolVisitsIfCompacted: number
  }[]
}

export function compareMethodTargets(
  data: AppData,
  activeWeekends: ResolvedWeekend[],
): MethodComparison[] {
  const { parents, classes } = data

  return (['inverse', 'per-student'] as WeightMethod[]).map((method) => {
    const targets = computeTargets(parents, activeWeekends, classes, method)

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

  const globalTarget = computeTargets(parents, activeWeekends, classes, method)
  const globalActual = new Map(parents.map((p) => [p.id, 0]))

  const result: Assignment[] = []

  const parentDayOnWeekend = new Map<string, Map<string, DaySlot>>()
  for (const w of activeWeekends) {
    parentDayOnWeekend.set(w.fridayDate, new Map())
  }

  for (const weekend of activeWeekends) {
    const pdMap = parentDayOnWeekend.get(weekend.fridayDate)!

    for (const cls of classes) {
      // Only parents with an ACTIVE kid in this class this weekend
      const eligible = parents.filter((p) =>
        isEligibleFor(p, cls.id, weekend.fridayDate)
      )
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

      // Find the active kid for this class on this weekend
      const kid = chosen.kids.find(
        (k) => k.classId === cls.id && isKidActiveOn(k, weekend.fridayDate)
      )!

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
  activeWeekends: ResolvedWeekend[],
  method: WeightMethod = 'inverse',
): ParentStats[] {
  const { parents, classes, assignments } = data
  const classMap = new Map(classes.map((c) => [c.id, c]))
  const targets = computeTargets(parents, activeWeekends, classes, method)

  return parents.map((p) => {
    const target = targets.get(p.id) ?? 0
    const myAssignments = assignments.filter((a) => a.parentId === p.id)

    const byWeekend = new Map<string, number>()
    for (const a of myAssignments) {
      byWeekend.set(a.weekendFriday, (byWeekend.get(a.weekendFriday) ?? 0) + 1)
    }

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
      compactedWeekends: [...byWeekend.values()].filter((n) => n >= 2).length,
    }
  })
}
