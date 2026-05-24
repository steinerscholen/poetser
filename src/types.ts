export type DaySlot = 'friday' | 'saturday' | 'sunday'

export const DAY_LABELS: Record<DaySlot, string> = {
  friday: 'Vrijdag',
  saturday: 'Zaterdag',
  sunday: 'Zondag',
}

// ─── Data model ──────────────────────────────────────────────────────────────

export interface SchoolClass {
  id: string
  name: string // e.g. "Klas 1A"
}

export interface Kid {
  id: string
  name: string
  classId: string
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

/** Per-weekend overrides. Key = ISO date of the Friday of that weekend. */
export interface WeekendOverride {
  fridayDate: string   // YYYY-MM-DD
  availableDays: DaySlot[]  // which days are available (empty = skip entirely)
  forcedDay?: DaySlot  // if set, cleaning MUST happen on this day
  note?: string
}

export interface SchoolYear {
  start: string  // YYYY-MM-DD  (typically Sept 1)
  end: string    // YYYY-MM-DD  (typically June 30 next year)
}

// ─── Algorithm method ─────────────────────────────────────────────────────────

/**
 * inverse   — weight = 1/kids  → 1-kind poetst het meest, 4-kinderen het minst
 * per-student — weight = kids  → ieder gezin evenveel sessies, meer kinderen = meer klassen per sessie
 */
export type WeightMethod = 'inverse' | 'per-student'

export const METHOD_LABELS: Record<WeightMethod, string> = {
  'inverse':     'Methode 1 — meer kinderen, minder beurten',
  'per-student': 'Methode 2 — gelijk aantal sessies per gezin',
}

// ─── Algorithm output ────────────────────────────────────────────────────────

export interface Assignment {
  weekendFriday: string  // ISO date of the Friday
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
  weekendOverrides: WeekendOverride[]
  /** Default days available every weekend unless overridden. */
  defaultAvailableDays: DaySlot[]
  /** Last generated schedule. */
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
  weekendOverrides: [],
  defaultAvailableDays: ['saturday'],
  assignments: [],
}
