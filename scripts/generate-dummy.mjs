/**
 * Generates a dummy leerlingenlijst.xlsx for Poetser testing.
 *
 * Demographics:
 *   25% families with 1 kid
 *   70% families with 2–3 kids  (split ~50/50 within that group)
 *    5% families with 4 kids
 *
 * Classes:
 *   Peuter  P1, P2            → 16–20 leerlingen
 *   Kleuter K1, K2, K3        → 16–20 leerlingen
 *   Lager   L1 … L6           → 22–26 leerlingen
 */

import * as XLSX from 'xlsx'
import { writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __dir = dirname(fileURLToPath(import.meta.url))

// ─── Seeded RNG (Mulberry32) ──────────────────────────────────────────────────
class RNG {
  constructor(seed) { this.s = seed >>> 0 }
  next() {
    let s = (this.s += 0x6D2B79F5)
    s = Math.imul(s ^ s >>> 15, s | 1)
    s ^= s + Math.imul(s ^ s >>> 7, s | 61)
    return ((s ^ s >>> 14) >>> 0) / 0x100000000
  }
  int(lo, hi)  { return Math.floor(this.next() * (hi - lo + 1)) + lo }
  pick(arr)    { return arr[this.int(0, arr.length - 1)] }
  shuffle(arr) {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) {
      const j = this.int(0, i);[a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }
}

const rng = new RNG(2025)

// ─── Class definitions ────────────────────────────────────────────────────────

const CLASSES = [
  { id: 'p1', name: 'Peuterklas juf Sofie',          lo: 16, hi: 20 },
  { id: 'p2', name: 'Peuterklas juf Lien',            lo: 16, hi: 20 },
  { id: 'k1', name: '1e Kleuterklas juf Hanne',       lo: 16, hi: 20 },
  { id: 'k2', name: '2e Kleuterklas juf Sara',        lo: 16, hi: 20 },
  { id: 'k3', name: '3e Kleuterklas juf Nathalie',    lo: 16, hi: 20 },
  { id: 'l1', name: '1e Leerjaar juf Elke',           lo: 22, hi: 26 },
  { id: 'l2', name: '2e Leerjaar meester Thomas',     lo: 22, hi: 26 },
  { id: 'l3', name: '3e Leerjaar juf Annelies',       lo: 22, hi: 26 },
  { id: 'l4', name: '4e Leerjaar meester Pieter',     lo: 22, hi: 26 },
  { id: 'l5', name: '5e Leerjaar juf Karen',          lo: 22, hi: 26 },
  { id: 'l6', name: '6e Leerjaar meester Dirk',       lo: 22, hi: 26 },
]

// ─── Name pools ───────────────────────────────────────────────────────────────

// Kid first names — alternative/nature/Steiner vibe
const BOYS = [
  'Finn','Bram','Tibo','Senne','Lowie','Warre','Wolf','Rune','Milo','Noel',
  'Jasper','Luca','Felix','Noah','Elias','Cas','Jelle','Robbe','Floris','Vic',
  'River','Forest','Bowie','Arlo','Sven','Lars','Leon','Max','Pip','Ferre',
  'Mauro','Matteo','Nico','Hamza','Adam','Kai','Zen','Coen','Bo','Siebe',
  'Wout','Arno','Stef','Joris','Pieter','Niels','Ruben','Kobe','Tijs','Emile',
]

const GIRLS = [
  'Noor','Lore','Fien','Saar','Amber','Luna','Wren','Fenna','Roos','Flo',
  'Lies','Emma','Noa','Lena','Hanna','Ines','Elsa','Lobke','Eline','Bo',
  'Leila','Yasmine','Maya','Zoe','Iris','Violet','Lily','Fleur','Camille','Cleo',
  'Freya','Astrid','Runa','Alba','Eloise','Lotte','Stien','Floor','Axelle','Femke',
  'Tine','An','Ine','Hilde','Julie','Jana','Lieselot','Hannelore','Silke','Elien',
]

// Parent first names (adult generation, more classic + some alternative)
const PARENT_M = [
  'Tom','Bram','Joris','Wouter','Stef','Jan','Pieter','Koen','Tim','Wim',
  'Luc','Frank','Bruno','Marc','Sander','Niels','Ruben','Lars','Mathias','Arno',
  'Arne','Joren','Geert','Bart','Dirk','Patrick','Xavier','Cedric','Maarten','Jeroen',
  'Ali','Hassan','Ibrahim','Youssef','Mehmet','Karim','Omar','Tarik','Samir','Bilal',
]

const PARENT_F = [
  'Sofie','Luna','Noor','An','Lies','Griet','Veerle','Inge','Hilde','Astrid',
  'Maaike','Anke','Katrien','Karen','Heidi','Liesbeth','Eline','Tine','Sarah','Emma',
  'Stien','Charlotte','Marie','Ella','Floor','Nathalie','Hannelore','Ines','Elke','Lore',
  'Fatima','Leila','Nadia','Aicha','Yasmine','Samira','Khadija','Amina','Souad','Naima',
]

// Family surnames — mix of Ghent-area + international alternative
const SURNAMES = [
  'De Wolf','Storms','Vandenberghe','De Groote','Verhaeghe','Nijs','De Backer','Van Damme',
  'Bogaert','Desmet','Claeys','De Smedt','Van den Berghe','Adriaens','Cools','De Cock',
  'Janssens','Lambrecht','Peeters','Stevens','Van Acker','Verbeke','Willems','De Moor',
  'Michiels','Soetens','Vandekerckhove','Van Hoof','Wyffels','Baert','Declercq','De Graef',
  'Fonteyne','Ghys','Hermans','Mertens','Oosterlinck','Pattyn','Renders','Sabbe','Braeckman',
  'Vantomme','De Brul','Wante','Goossens','Raes','De Sutter','Lemmens','Vermeersch','Van Haute',
  'Ouali','Ben Youssef','Demir','El Amrani','Ngabo','Nguyen','Garcia','Rossi','Schmidt','Dubois',
  'Laurent','Moreau','Lecomte','Fontaine','Bernard','Martin','Klein','Müller','Eriksson','Tanaka',
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function kidName(usedInClass) {
  // pick a name not yet used in this class
  const pool = rng.int(0, 1) ? GIRLS : BOYS
  const shuffled = rng.shuffle(pool)
  return shuffled.find(n => !usedInClass.has(n)) ?? rng.pick(pool)
}

function parentFullName(surname) {
  const isMother = rng.next() < 0.55  // slight majority mothers on list
  const first = isMother ? rng.pick(PARENT_F) : rng.pick(PARENT_M)
  return `${first} ${surname}`
}

// ─── Build class slots ────────────────────────────────────────────────────────

const classSizes = CLASSES.map(c => ({ ...c, size: rng.int(c.lo, c.hi), slots: [] }))
const totalSlots  = classSizes.reduce((s, c) => s + c.size, 0)

console.log('Class sizes:')
classSizes.forEach(c => console.log(`  ${c.name}: ${c.size}`))
console.log(`  Total slots: ${totalSlots}`)

// ─── Build families ───────────────────────────────────────────────────────────
// Target demographics over total families F:
//   25%  → 1 kid     weight 1
//   35%  → 2 kids    weight 2
//   35%  → 3 kids    weight 3
//    5%  → 4 kids    weight 4
// Expected kids/family = 0.25*1 + 0.35*2 + 0.35*3 + 0.05*4 = 2.2

// Pre-determine exact family sizes to hit the demographic targets:
//   25% → 1 kid,  35% → 2 kids,  35% → 3 kids,  5% → 4 kids
// Solve: F * (0.25*1 + 0.35*2 + 0.35*3 + 0.05*4) = totalSlots  →  F ≈ totalSlots / 2.2
const AVG_KIDS = 0.25*1 + 0.35*2 + 0.35*3 + 0.05*4  // 2.2
const F = Math.round(totalSlots / AVG_KIDS)

const n4 = Math.round(F * 0.05)
const n3 = Math.round(F * 0.35)
const n2 = Math.round(F * 0.35)
const n1 = F - n4 - n3 - n2  // absorb rounding in the 1-kid group

const familySizeList = [
  ...Array(n4).fill(4),
  ...Array(n3).fill(3),
  ...Array(n2).fill(2),
  ...Array(n1).fill(1),
]
const shuffledSizes = rng.shuffle(familySizeList)

// Build family objects
const usedSurnames = new Set()
const families = []
let surnameBag = rng.shuffle([...SURNAMES])

for (const kidCount of shuffledSizes) {
  if (!surnameBag.length) surnameBag = rng.shuffle([...SURNAMES])
  let surname = surnameBag.pop()
  let tries = 0
  while (usedSurnames.has(surname) && tries++ < 20) {
    surnameBag.unshift(surname)
    surname = surnameBag.pop() ?? surname
  }
  usedSurnames.add(surname)
  families.push({ surname, kidCount, parent: parentFullName(surname) })
}

console.log(`\nFamilies: ${families.length} (${n1}×1, ${n2}×2, ${n3}×3, ${n4}×4 = ${n1+n2*2+n3*3+n4*4} kinderen)`)

// ─── Assign kids to class slots ───────────────────────────────────────────────
// Strategy:
//   Shuffle classes. For each family, assign each kid to a DIFFERENT class.
//   Multi-kid families get spread across different classes.
//   Prefer siblings to span across peuter/kleuter/lager levels when possible.

// Group classes by level for sibling spread
const LEVELS = [
  classSizes.filter(c => c.id.startsWith('p')),
  classSizes.filter(c => c.id.startsWith('k')),
  classSizes.filter(c => c.id.startsWith('l')),
]

function availableClassesForSibling(alreadyAssigned) {
  // Prefer a different level first, then any class with space that isn't already used by this family
  const usedIds = new Set(alreadyAssigned)
  const withSpace = classSizes.filter(c => c.slots.length < c.size && !usedIds.has(c.id))
  if (!withSpace.length) return null

  // Try to pick from a level not yet used by this family
  const usedLevels = new Set(alreadyAssigned.map(id => LEVELS.findIndex(lv => lv.some(c => c.id === id))))
  const fromUnusedLevel = withSpace.filter(c =>
    !usedLevels.has(LEVELS.findIndex(lv => lv.some(cc => cc.id === c.id)))
  )
  const pool = fromUnusedLevel.length ? fromUnusedLevel : withSpace
  return rng.pick(pool)
}

const usedNamesPerClass = Object.fromEntries(classSizes.map(c => [c.id, new Set()]))
const rows = []  // final Excel rows

for (const family of families) {
  const assigned = []  // class ids assigned to this family's kids

  for (let k = 0; k < family.kidCount; k++) {
    const cls = availableClassesForSibling(assigned)
    if (!cls) break  // all classes full — stop adding kids for this family

    const name = kidName(usedNamesPerClass[cls.id])
    usedNamesPerClass[cls.id].add(name)
    cls.slots.push({ kid: name, parent: family.parent, class: cls.name })
    assigned.push(cls.id)
  }
}

// ─── Collect rows and shuffle ─────────────────────────────────────────────────

for (const cls of classSizes) {
  for (const entry of cls.slots) {
    rows.push({
      'Naam kind':  entry.kid,
      'Klas':       entry.class,
      'Naam ouder': entry.parent,
    })
  }
}

const shuffledRows = rng.shuffle(rows)

// ─── Write Excel ──────────────────────────────────────────────────────────────

const ws = XLSX.utils.json_to_sheet(shuffledRows)

// Column widths
ws['!cols'] = [{ wch: 20 }, { wch: 32 }, { wch: 24 }]

const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, ws, 'Leerlingen')

const outPath = resolve(__dir, '../public/leerlingenlijst-dummy.xlsx')
XLSX.writeFile(wb, outPath)

console.log(`\n✓ ${shuffledRows.length} leerlingen weggeschreven naar:\n  ${outPath}`)

// ─── Quick stats ──────────────────────────────────────────────────────────────

const byClass = {}
for (const r of shuffledRows) byClass[r['Klas']] = (byClass[r['Klas']] ?? 0) + 1
console.log('\nKlasgrootten:')
for (const [cls, n] of Object.entries(byClass)) console.log(`  ${cls}: ${n}`)

const byParent = {}
for (const r of shuffledRows) byParent[r['Naam ouder']] = (byParent[r['Naam ouder']] ?? 0) + 1
const dist = { 1: 0, 2: 0, 3: 0, 4: 0 }
for (const n of Object.values(byParent)) dist[Math.min(n, 4)]++
console.log('\nOuderdemografie (kinderen per gezin):')
const total = Object.values(dist).reduce((s, n) => s + n, 0)
for (const [k, n] of Object.entries(dist)) console.log(`  ${k} kind(eren): ${n} gezinnen (${Math.round(n/total*100)}%)`)
