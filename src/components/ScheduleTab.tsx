import { useState } from 'react'
import { useStore } from '../store'
import {
  generateSchedule,
  resolveWeekends,
  computeStats,
  compareMethodTargets,
} from '../algorithm'
import type { MethodComparison } from '../algorithm'
import { DAY_LABELS, METHOD_LABELS } from '../types'
import type { WeightMethod } from '../types'
import { fmtWeekend } from '../utils/dates'
import {
  exportAllClassesXlsx,
  exportPerClassXlsx,
  printAllClasses,
  printPerClass,
  printParentsAlpha,
} from '../utils/export'

const CLASS_COLORS = [
  'bg-blue-50 text-blue-900',   'bg-green-50 text-green-900',
  'bg-purple-50 text-purple-900', 'bg-amber-50 text-amber-900',
  'bg-rose-50 text-rose-900',   'bg-teal-50 text-teal-900',
  'bg-orange-50 text-orange-900', 'bg-indigo-50 text-indigo-900',
]
const DAY_BADGE: Record<string, string> = {
  friday: 'bg-violet-100 text-violet-700',
  saturday: 'bg-sky-100 text-sky-700',
  sunday: 'bg-emerald-100 text-emerald-700',
}

const METHOD_ICON: Record<WeightMethod, string> = {
  sqrt:          '⚖️',
  'per-student': '🔄',
}

export default function ScheduleTab() {
  const { data, update } = useStore()

  const [method, setMethod]         = useState<WeightMethod>('sqrt')
  const [comparison, setComparison] = useState<MethodComparison[] | null>(null)
  const [showExport, setShowExport] = useState(false)

  const weekends       = resolveWeekends(data)
  const activeWeekends = weekends.filter((w) => !w.skipped)
  const { classes, assignments } = data

  const canGenerate =
    data.classes.length > 0 &&
    data.parents.length > 0 &&
    data.parents.some((p) => p.kids.length > 0)

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleCalculate = () => {
    setComparison(compareMethodTargets(data, activeWeekends))
  }

  const handleGenerate = () => {
    const result = generateSchedule(data, method)
    update((d) => { d.assignments = result })
  }

  // ── Lookups ────────────────────────────────────────────────────────────────

  const lookup = new Map<string, typeof assignments[0]>()
  for (const a of assignments) lookup.set(`${a.weekendFriday}::${a.classId}`, a)

  // Map fridayDate → resolved weekend (for available-days count and note)
  const weekendMeta = new Map(weekends.map((w) => [w.fridayDate, w]))

  const parentName = new Map(data.parents.map((p) => [p.id, p.name]))
  const kidName    = new Map(data.parents.flatMap((p) => p.kids.map((k) => [k.id, k.name])))

  const stats = assignments.length > 0
    ? computeStats(data, activeWeekends, method)
    : []

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-gray-900">Poetsrooster</h2>
          <p className="text-sm text-gray-500">
            {assignments.length > 0
              ? `${assignments.length} toewijzingen · ${activeWeekends.length} actieve weekends`
              : `${activeWeekends.length} actieve weekends · nog geen rooster gegenereerd`}
          </p>
        </div>

        {/* Export dropdown */}
        <div className="relative print:hidden">
          <button
            onClick={() => setShowExport((v) => !v)}
            disabled={assignments.length === 0}
            className="bg-white border border-gray-300 hover:border-gray-400 disabled:opacity-40 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
          >
            📤 Exporteren <span className="text-gray-400 text-xs">▾</span>
          </button>

          {showExport && (
            <>
              {/* Click-outside backdrop */}
              <div className="fixed inset-0 z-10" onClick={() => setShowExport(false)} />
              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 min-w-60 py-2">

                <div className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">Excel</div>
                <button
                  onClick={() => { exportAllClassesXlsx(data, activeWeekends); setShowExport(false) }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  📊 Alle klassen
                </button>
                <button
                  onClick={() => { exportPerClassXlsx(data, activeWeekends); setShowExport(false) }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  📊 Per klas (aparte tabbladen)
                </button>

                <div className="border-t border-gray-100 mt-1 pt-1 px-3 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">PDF / Afdrukken</div>
                <button
                  onClick={() => { printAllClasses(data, activeWeekends); setShowExport(false) }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  🖨 Alle klassen
                </button>
                <button
                  onClick={() => { printPerClass(data, activeWeekends); setShowExport(false) }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  🖨 Per klas
                </button>
                <button
                  onClick={() => { printParentsAlpha(data); setShowExport(false) }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  🖨 Ouders alfabetisch
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {!canGenerate && (
        <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
          Voeg eerst klassen en ouders met kinderen toe.
        </p>
      )}

      {/* ── Bereken + methode ── */}
      {canGenerate && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 print:hidden">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <h3 className="font-semibold text-gray-900">Verdeling berekenen</h3>
            <button
              onClick={handleCalculate}
              className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
            >
              🔢 Bereken verdeling
            </button>
          </div>

          {/* Comparison table */}
          {comparison && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500">
                Verwachte verdeling per gezin bij <strong>{activeWeekends.length} actieve weekends</strong> en <strong>{classes.length} klassen</strong>.
                Schoolbezoeken = berekend met perfecte compactie (alle klassen van een gezin poetsen in één bezoek aan de school).
              </p>

              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      <th className="px-4 py-2 text-left">Kinderen</th>
                      <th className="px-3 py-2 text-center text-gray-400">Gezinnen</th>
                      {comparison.map((c) => (
                        <th key={c.method} className="px-4 py-2 text-center" colSpan={2}>
                          {METHOD_ICON[c.method]} {c.method === 'sqrt' ? 'Methode 1' : 'Methode 2'}
                        </th>
                      ))}
                    </tr>
                    <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-400">
                      <th className="px-4 py-2" />
                      <th className="px-3 py-2" />
                      {comparison.map((c) => (
                        <>
                          <th key={`${c.method}-a`} className="px-4 py-2 text-center font-normal">beurten</th>
                          <th key={`${c.method}-b`} className="px-4 py-2 text-center font-normal border-r border-gray-200">schoolbezoeken</th>
                        </>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(comparison[0]?.byKidCount ?? []).map((row, i) => (
                      <tr key={row.kids} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                        <td className="px-4 py-2 font-medium text-gray-800">
                          {row.kids} {row.kids === 1 ? 'kind' : 'kinderen'}
                        </td>
                        <td className="px-3 py-2 text-center text-gray-400 text-xs">{row.familyCount}</td>
                        {comparison.map((c) => {
                          const r = c.byKidCount.find((x) => x.kids === row.kids)
                          return (
                            <>
                              <td key={`${c.method}-a`} className="px-4 py-2 text-center font-semibold text-brand-700">
                                {r?.target.toFixed(1) ?? '—'}
                              </td>
                              <td key={`${c.method}-b`} className="px-4 py-2 text-center text-gray-500 border-r border-gray-200">
                                {r?.schoolVisitsIfCompacted.toFixed(1) ?? '—'}
                              </td>
                            </>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-gray-500">
                <div className="bg-brand-50 border border-brand-200 rounded-lg p-3">
                  <span className="font-semibold text-brand-800">⚖️ Methode 1 — gebalanceerd</span><br />
                  Gewicht = √kinderen. Elk extra kind geeft een gedeeltelijke korting op het aantal beurten.
                  Grote gezinnen doen meer dan bij methode 2, maar komen minder vaak langs dan kleine gezinnen.
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <span className="font-semibold text-gray-700">🔄 Methode 2 — gelijk aantal sessies</span><br />
                  Elk gezin komt even vaak naar school poetsen (~{comparison[1]?.byKidCount[0]?.schoolVisitsIfCompacted.toFixed(1)}×).
                  Een 3-kinderenouder poetst bij elk bezoek 3 klassen; een 1-kindouder poetst er 1.
                </div>
              </div>
            </div>
          )}

          {/* Method selector + generate */}
          <div className="border-t border-gray-100 pt-4 flex items-center gap-4 flex-wrap">
            <span className="text-sm font-medium text-gray-700">Methode:</span>
            {(['sqrt', 'per-student'] as WeightMethod[]).map((m) => (
              <label key={m} className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                <input
                  type="radio"
                  name="method"
                  value={m}
                  checked={method === m}
                  onChange={() => setMethod(m)}
                  className="accent-brand-600"
                />
                {METHOD_ICON[m]} {m === 'sqrt' ? 'Methode 1' : 'Methode 2'}
              </label>
            ))}
            <button
              onClick={handleGenerate}
              className="ml-auto bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-6 py-2 rounded-lg transition-colors"
            >
              ↺ Genereren
            </button>
          </div>
        </div>
      )}

      {/* ── Schedule grid ── */}
      {assignments.length > 0 && (
        <>
          {/* Method label above grid */}
          <div className="flex items-center gap-2 text-xs text-gray-500 print:hidden">
            <span className="bg-brand-50 text-brand-700 border border-brand-200 rounded-full px-3 py-1">
              {METHOD_LABELS[method]}
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="min-w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap sticky left-0 bg-gray-50">
                    Weekend
                  </th>
                  {classes.map((cls, i) => (
                    <th
                      key={cls.id}
                      className={`px-4 py-3 font-semibold text-center whitespace-nowrap ${CLASS_COLORS[i % CLASS_COLORS.length]}`}
                    >
                      {cls.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weekends.map((w, wi) => {
                  const isEven = wi % 2 === 0
                  return (
                    <tr key={w.fridayDate} className={`border-b border-gray-100 ${w.skipped ? 'opacity-40' : isEven ? 'bg-white' : 'bg-gray-50/50'}`}>
                      <td className={`px-4 py-3 whitespace-nowrap sticky left-0 ${isEven ? 'bg-white' : 'bg-gray-50'}`}>
                        <div className="font-medium text-gray-800">{fmtWeekend(w.fridayDate)}</div>
                        {w.isHoliday && !w.skipped && <div className="text-xs text-amber-600">{w.holidayName}</div>}
                        {w.skipped && <div className="text-xs text-gray-400 italic">{w.holidayName ?? 'overgeslagen'}</div>}
                        {w.note && <div className="text-xs text-blue-600 italic mt-0.5">{w.note}</div>}
                      </td>
                      {classes.map((cls) => {
                        const a = lookup.get(`${w.fridayDate}::${cls.id}`)
                        if (w.skipped || !a) return (
                          <td key={cls.id} className="px-4 py-3 text-center text-gray-300 text-xs italic">
                            {w.skipped ? '—' : '?'}
                          </td>
                        )
                        return (
                          <td key={cls.id} className="px-4 py-3 text-center">
                            <div className="font-medium text-gray-900">{kidName.get(a.kidId) ?? '?'}</div>
                            <div className="text-xs text-gray-400">{parentName.get(a.parentId)}</div>
                            {(weekendMeta.get(a.weekendFriday)?.availableDays.length ?? 2) === 1 && (
                              <span className={`inline-block mt-1 text-xs rounded-full px-2 py-0.5 ${DAY_BADGE[a.day]}`}>
                                {DAY_LABELS[a.day].slice(0, 3)}
                              </span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── Stats table ── */}
      {stats.length > 0 && (
        <div className="mt-6 print:hidden">
          <h3 className="text-base font-semibold text-gray-800 mb-3">Verdeling per ouder</h3>
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="min-w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-2 font-semibold text-gray-600">Ouder</th>
                  <th className="text-center px-4 py-2 font-semibold text-gray-600">Kinderen</th>
                  <th className="text-center px-4 py-2 font-semibold text-gray-600">Doel</th>
                  <th className="text-center px-4 py-2 font-semibold text-gray-600">Beurten</th>
                  <th className="text-center px-4 py-2 font-semibold text-gray-600">Δ</th>
                  <th className="text-center px-4 py-2 font-semibold text-gray-600">Gecombineerd</th>
                  <th className="text-left px-4 py-2 font-semibold text-gray-600">Per klas</th>
                </tr>
              </thead>
              <tbody>
                {stats
                  .slice()
                  .sort((a, b) => a.totalKids - b.totalKids || b.assignmentCount - a.assignmentCount)
                  .map((s, i) => {
                    const dev = s.deviation
                    const devColor = Math.abs(dev) <= 1 ? 'text-gray-400' : dev > 0 ? 'text-amber-600' : 'text-blue-500'
                    return (
                      <tr key={s.parentId} className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                        <td className="px-4 py-2 font-medium text-gray-900">{s.parentName}</td>
                        <td className="px-4 py-2 text-center text-gray-600">{s.totalKids}</td>
                        <td className="px-4 py-2 text-center text-gray-400">{s.target.toFixed(1)}</td>
                        <td className="px-4 py-2 text-center font-semibold text-brand-700">{s.assignmentCount}</td>
                        <td className={`px-4 py-2 text-center text-xs font-medium ${devColor}`}>
                          {dev > 0 ? `+${dev.toFixed(1)}` : dev.toFixed(1)}
                        </td>
                        <td className="px-4 py-2 text-center text-gray-600">
                          {s.compactedWeekends > 0 ? <span className="text-green-600">{s.compactedWeekends}×</span> : '—'}
                        </td>
                        <td className="px-4 py-2 text-gray-500 text-xs">
                          {s.classes.map((c) => `${c.className}: ${c.count}×`).join(', ')}
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
