/**
 * Export helpers — Excel (via xlsx) and print-to-PDF (via a new browser window).
 *
 * Three export shapes:
 *   • allClasses  — grid: rows = weekends, columns = classes
 *   • perClass    — one sheet / page per class with the weekend list
 *   • parentsAlpha — all parents A→Z with their assigned weekends
 */

import * as XLSX from 'xlsx'
import type { AppData, Assignment } from '../types'
import type { ResolvedWeekend } from '../algorithm'
import { DAY_LABELS } from '../types'
import { fmtWeekend } from './dates'

// ── Shared lookup ─────────────────────────────────────────────────────────────

function buildLookup(assignments: Assignment[]) {
  const map = new Map<string, Assignment>()
  for (const a of assignments) map.set(`${a.weekendFriday}::${a.classId}`, a)
  return (friday: string, classId: string) => map.get(`${friday}::${classId}`)
}

function buildNameMaps(data: AppData) {
  const parentName = new Map(data.parents.map((p) => [p.id, p.name]))
  const kidName    = new Map(data.parents.flatMap((p) => p.kids.map((k) => [k.id, k.name])))
  return { parentName, kidName }
}

// ── Excel ─────────────────────────────────────────────────────────────────────

/** One sheet: grid with weekends as rows and classes as columns. */
export function exportAllClassesXlsx(data: AppData, activeWeekends: ResolvedWeekend[]) {
  const { classes, assignments } = data
  const { parentName, kidName } = buildNameMaps(data)
  const lookup = buildLookup(assignments)

  const header = ['Weekend', ...classes.map((c) => c.name)]
  const rows = activeWeekends.map((w) => {
    const cells: string[] = [fmtWeekend(w.fridayDate)]
    for (const cls of classes) {
      const a = lookup(w.fridayDate, cls.id)
      cells.push(a
        ? `${kidName.get(a.kidId) ?? '?'} (${parentName.get(a.parentId) ?? '?'})`
        : '?')
    }
    return cells
  })

  const ws = XLSX.utils.aoa_to_sheet([header, ...rows])
  // Set column widths
  ws['!cols'] = [{ wch: 14 }, ...classes.map(() => ({ wch: 24 }))]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Overzicht')
  XLSX.writeFile(wb, 'poetsrooster-overzicht.xlsx')
}

/** One workbook with a separate sheet per class. */
export function exportPerClassXlsx(data: AppData, activeWeekends: ResolvedWeekend[]) {
  const { classes, assignments } = data
  const { parentName, kidName } = buildNameMaps(data)
  const lookup = buildLookup(assignments)

  const wb = XLSX.utils.book_new()

  for (const cls of classes) {
    const header = ['Weekend', 'Dag', 'Ouder', 'Kind']
    const rows = activeWeekends.map((w) => {
      const a = lookup(w.fridayDate, cls.id)
      return [
        fmtWeekend(w.fridayDate),
        a ? DAY_LABELS[a.day] : '',
        a ? (parentName.get(a.parentId) ?? '?') : '',
        a ? (kidName.get(a.kidId)    ?? '?') : '',
      ]
    })

    const ws = XLSX.utils.aoa_to_sheet([header, ...rows])
    ws['!cols'] = [{ wch: 14 }, { wch: 10 }, { wch: 22 }, { wch: 18 }]
    XLSX.utils.book_append_sheet(wb, ws, cls.name.slice(0, 31)) // Excel sheet names ≤ 31 chars
  }

  XLSX.writeFile(wb, 'poetsrooster-per-klas.xlsx')
}

// ── Print / PDF ───────────────────────────────────────────────────────────────

const PRINT_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, Arial, sans-serif; font-size: 11px; color: #111; padding: 20px; }
  h1 { font-size: 15px; font-weight: 700; margin-bottom: 14px; }
  h2 { font-size: 12px; font-weight: 700; margin: 0 0 6px; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 6px; }
  th { background: #f3f4f6; font-weight: 600; text-align: left; }
  th, td { border: 1px solid #d1d5db; padding: 4px 7px; white-space: nowrap; }
  small { color: #6b7280; font-size: 10px; }
  .section { margin-bottom: 32px; }
  .page-break { page-break-before: always; margin-bottom: 0; }
  @media print {
    body { padding: 0; }
    .page-break { page-break-before: always; }
  }
`

function openPrintWindow(title: string, body: string) {
  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(`<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>${PRINT_CSS}</style>
</head>
<body>${body}</body>
</html>`)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 300)
}

/** Grid overview: rows = weekends, columns = classes. */
export function printAllClasses(data: AppData, activeWeekends: ResolvedWeekend[]) {
  const { classes, assignments } = data
  const { parentName, kidName } = buildNameMaps(data)
  const lookup = buildLookup(assignments)

  const ths = ['<th>Weekend</th>', ...classes.map((c) => `<th>${esc(c.name)}</th>`)].join('')
  const trs = activeWeekends.map((w) => {
    const tds = classes.map((cls) => {
      const a = lookup(w.fridayDate, cls.id)
      return a
        ? `<td>${esc(kidName.get(a.kidId) ?? '?')}<br><small>${esc(parentName.get(a.parentId) ?? '?')}</small></td>`
        : `<td style="color:#aaa">—</td>`
    }).join('')
    return `<tr><td>${esc(fmtWeekend(w.fridayDate))}</td>${tds}</tr>`
  }).join('')

  openPrintWindow('Poetsrooster — alle klassen', `
    <h1>Poetsrooster — alle klassen</h1>
    <table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>
  `)
}

/** One page per class, listing weekends with parent + kid. */
export function printPerClass(data: AppData, activeWeekends: ResolvedWeekend[]) {
  const { classes, assignments } = data
  const { parentName, kidName } = buildNameMaps(data)
  const lookup = buildLookup(assignments)

  const sections = classes.map((cls, i) => {
    const trs = activeWeekends.map((w) => {
      const a = lookup(w.fridayDate, cls.id)
      return `<tr>
        <td>${esc(fmtWeekend(w.fridayDate))}</td>
        <td>${a ? esc(DAY_LABELS[a.day]) : '—'}</td>
        <td>${a ? esc(parentName.get(a.parentId) ?? '?') : '—'}</td>
        <td>${a ? esc(kidName.get(a.kidId) ?? '?') : '—'}</td>
      </tr>`
    }).join('')

    return `<div class="section${i > 0 ? ' page-break' : ''}">
      <h1>${esc(cls.name)}</h1>
      <table>
        <thead><tr><th>Weekend</th><th>Dag</th><th>Ouder</th><th>Kind</th></tr></thead>
        <tbody>${trs}</tbody>
      </table>
    </div>`
  }).join('')

  openPrintWindow('Poetsrooster — per klas', sections)
}

/** All parents sorted A→Z, each with their assigned weekends. */
export function printParentsAlpha(data: AppData) {
  const { parents, classes, assignments } = data
  const classMap = new Map(classes.map((c) => [c.id, c.name]))

  const sorted = [...parents].sort((a, b) => a.name.localeCompare(b.name, 'nl'))

  const trs = sorted.flatMap((p) => {
    const mine = assignments
      .filter((a) => a.parentId === p.id)
      .sort((a, b) => a.weekendFriday.localeCompare(b.weekendFriday))
    if (mine.length === 0) return []

    return mine.map((a, i) => `<tr>
      ${i === 0
        ? `<td rowspan="${mine.length}" style="font-weight:600;vertical-align:top">${esc(p.name)}</td>`
        : ''}
      <td>${esc(fmtWeekend(a.weekendFriday))}</td>
      <td>${esc(classMap.get(a.classId) ?? '?')}</td>
      <td>${esc(DAY_LABELS[a.day])}</td>
    </tr>`)
  }).join('')

  openPrintWindow('Poetsrooster — ouders alfabetisch', `
    <h1>Poetsrooster — ouders alfabetisch</h1>
    <table>
      <thead><tr><th>Ouder</th><th>Weekend</th><th>Klas</th><th>Dag</th></tr></thead>
      <tbody>${trs}</tbody>
    </table>
  `)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Escape HTML special chars to prevent injection in print windows. */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
