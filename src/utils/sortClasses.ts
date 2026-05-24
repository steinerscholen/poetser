import type { SchoolClass } from '../types'

/**
 * Determines the broad group of a class based on its name.
 *   0 = peuter
 *   1 = kleuter
 *   2 = lager onderwijs
 *   3 = middelbaar onderwijs
 *   4 = everything else
 */
function group(name: string): number {
  const l = name.toLowerCase()
  if (l.includes('peuter')) return 0
  if (l.includes('kleuter')) return 1
  if (l.includes('middelbaar') || l.includes('secundair') || l.includes('humaniora')) return 3
  // Lager: explicit keyword OR typical "Xe leerjaar" patterns (1–6)
  if (l.includes('lager') || l.includes('leerjaar')) return 2
  return 4
}

/**
 * Extracts a leading ordinal number from a name like "3e Leerjaar …" → 3.
 * Returns 0 if none found.
 */
function leadingNumber(name: string): number {
  const m = name.match(/^(\d+)/)
  return m ? parseInt(m[1], 10) : 0
}

/**
 * Returns a sort key that orders classes as:
 *   Peuter → Kleuter → Lager → Middelbaar → overige
 *   Within each group: by leading ordinal, then alphabetically.
 */
export function classSortKey(name: string): string {
  return `${group(name)}-${String(leadingNumber(name)).padStart(2, '0')}-${name.toLowerCase()}`
}

/** Sort an array of SchoolClass objects in-place. Returns the same array. */
export function sortClasses(classes: SchoolClass[]): SchoolClass[] {
  return classes.sort((a, b) => classSortKey(a.name).localeCompare(classSortKey(b.name)))
}
