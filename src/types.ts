export type DaySlot = 'friday' | 'saturday' | 'sunday'

export const DAY_LABELS: Record<DaySlot, string> = {
  friday: 'Vrijdag',
  saturday: 'Zaterdag',
  sunday: 'Zondag',
}

// ─── Data model ──────────────────────────────────────────────────────────────

export interface SchoolClass {
  id: string
  name: string
}

export interface Kid {
  id: string
  name: string
  classId: string
  /**
   * ISO date from which this kid (and their parent) becomes eligible to clean
   * this class. Undefined = eligible from the start of the school year.
   * → Use for peuters who join mid-year.
   */
  activeFrom?: string
  /**
   * ISO date from which this kid is NO LONGER eligible for this class (exclusive).
   * Undefined = eligible until the end of the school year.
   * → Use for peuters transitioning to a kleuterklas.
   */
  activeTo?: string
}

export interface Parent {
  id: string
  name: string
  kids: Kid[]
}

export interface Holiday {
  id: string
  name: string
  startDate: string // YYYY-MM-DD
  endDate: string   // YYYY-MM-DD
}

/** Per-weekend overrides. */
export interface WeekendOverride {
  fridayDate: string
  availableDays: DaySlot[]
  forcedDay?: DaySlot
  note?: string
}

export interface SchoolYear {
  start: string
  end: string
}

/**
 * A named transition moment — the first school day after a holiday break.
 * These are used as activeFrom / activeTo values on kids so the UI can offer
 * a human-readable dropdown instead of raw date pickers.
 */
export interface TransitionMoment {
  id: string
  name: string  // e.g. "Na herfstvakantie"
  date: string  // YYYY-MM-DD: first school day after the break
}

// ─── Algorithm method ─────────────────────────────────────────────────────────

export type WeightMethod = 'inverse' | 'per-student'

export const METHOD_LABELS: Record<WeightMethod, string> = {
  'inverse':     'Methode 1 — meer kinderen, minder beurten',
  'per-student': 'Methode 2 — gelijk aantal sessies per gezin',
}

// ─── Algorithm output ────────────────────────────────────────────────────────

export interface Assignment {
  weekendFriday: string
  classId: string
  parentId: string
  kidId: string
  day: DaySlot
}

// ─── Full app state ──────────────────────────────────────────────────────────

export interface AppData {
  schoolYear: SchoolYear
  classes: SchoolClass[]
  parents: Parent[]
  holidays: Holiday[]
  transitionMoments: TransitionMoment[]
  weekendOverrides: WeekendOverride[]
  defaultAvailableDays: DaySlot[]
  assignments: Assignment[]
}

export const DEFAULT_DATA: AppData = {
  schoolYear: {
    start: '2025-09-01',
    end: '2026-06-30',
  },
  classes: [],
  parents: [],
  holidays: [
    { id: 'h1', name: 'Herfstvakantie',  startDate: '2025-10-27', endDate: '2025-11-02' },
    { id: 'h2', name: 'Kerstvakantie',   startDate: '2025-12-22', endDate: '2026-01-04' },
    { id: 'h3', name: 'Krokusvakantie',  startDate: '2026-02-16', endDate: '2026-02-22' },
    { id: 'h4', name: 'Paasvakantie',    startDate: '2026-04-06', endDate: '2026-04-19' },
  ],
  // First school day after each break — the natural transition moments for peuters
  transitionMoments: [
    { id: 't1', name: 'Na Allerheiligen',   date: '2025-11-03' },
    { id: 't2', name: 'Na kerstvakantie',   date: '2026-01-05' },
    { id: 't3', name: 'Na krokusvakantie',  date: '2026-02-23' },
    { id: 't4', name: 'Na paasvakantie',    date: '2026-04-20' },
    { id: 't5', name: 'Na zomervakantie',   date: '2026-09-01' },
  ],
  weekendOverrides: [],
  defaultAvailableDays: ['saturday', 'sunday'],
  assignments: [],
}
