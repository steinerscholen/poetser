import type { SchoolClass } from '../types'

/**
 * Determines the broad group of a class based on its name.
 *   0 = peuter, 1 = kleuter, 2 = lagere school / anything else
 */
function group(name: string): number {
  const l = name.toLowerCase()
  if (l.includes('peuter')) return 0
  if (l.includes('kleuter')) return 1
  return 2
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
 * Returns a sort key string that orders classes as:
 *   Peuter (0) → Kleuter (1) → Lager (2)
 *   Within each group: by leading ordinal, then alphabetically.
 */
export function classSortKey(name: string): string {
  return `${group(name)}-${String(leadingNumber(name)).padStart(2, '0')}-${name.toLowerCase()}`
}

/** Sort an array of SchoolClass objects in-place. Returns the same array. */
export function sortClasses(classes: SchoolClass[]): SchoolClass[] {
  return classes.sort((a, b) => classSortKey(a.name).localeCompare(classSortKey(b.name)))
}
