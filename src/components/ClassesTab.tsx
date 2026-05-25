import { useState, useMemo } from 'react'
import { useStore } from '../store'
import type { SchoolClass } from '../types'
import { sortClasses } from '../utils/sortClasses'
import { isKidActiveOn, resolveWeekends, effectiveKidCount } from '../algorithm'

function uid() { return crypto.randomUUID() }

export default function ClassesTab() {
  const { data, update } = useStore()
  const [name, setName] = useState('')

  const add = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    update((d) => { d.classes.push({ id: uid(), name: trimmed }) })
    setName('')
  }

  const remove = (id: string) => {
    update((d) => {
      d.classes = d.classes.filter((c) => c.id !== id)
      d.parents.forEach((p) => { p.kids = p.kids.filter((k) => k.classId !== id) })
    })
  }

  const rename = (cls: SchoolClass, newName: string) => {
    update((d) => {
      const c = d.classes.find((c) => c.id === cls.id)
      if (c) c.name = newName
    })
  }

  const autoSort = () => {
    update((d) => { sortClasses(d.classes) })
  }

  const move = (index: number, dir: -1 | 1) => {
    update((d) => {
      const target = index + dir
      if (target < 0 || target >= d.classes.length) return
      ;[d.classes[index], d.classes[target]] = [d.classes[target], d.classes[index]]
    })
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  const allKids = useMemo(
    () => data.parents.flatMap((p) => p.kids),
    [data.parents],
  )

  const activeWeekends = useMemo(
    () => resolveWeekends(data).filter((w) => !w.skipped),
    [data.schoolYear, data.holidays, data.weekendOverrides, data.defaultAvailableDays],
  )

  const stats = useMemo(() => {
    if (!allKids.length) return null

    // Physical kid count — transitions (two kid entries, one child) counted once
    const totalKids = data.parents.reduce(
      (sum, p) => sum + effectiveKidCount(p, activeWeekends),
      0,
    )
    const totalFamilies = data.parents.filter((p) => p.kids.length > 0).length

    // Year timeline: how many kids are active at start + each transition moment
    const phases = [
      { label: 'Begin schooljaar', date: data.schoolYear.start },
      ...data.transitionMoments
        .filter((m) => m.date > data.schoolYear.start && m.date <= data.schoolYear.end)
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((m) => ({ label: m.name, date: m.date })),
    ]
    let prev: number | null = null
    const timeline = phases.map(({ label, date }) => {
      const count = allKids.filter((k) => isKidActiveOn(k, date)).length
      const delta = prev !== null ? count - prev : null
      prev = count
      return { label, count, delta }
    })

    // Sibling demography grouped by max simultaneous kids
    const familyGroups = new Map<number, number>()
    for (const p of data.parents) {
      const n = effectiveKidCount(p, activeWeekends)
      if (n === 0) continue
      familyGroups.set(n, (familyGroups.get(n) ?? 0) + 1)
    }
    const demography = [...familyGroups.entries()].sort((a, b) => a[0] - b[0])

    // Top 5 first names
    const freq = new Map<string, number>()
    for (const kid of allKids) {
      const first = kid.name.trim().split(/\s+/)[0]
      if (first) freq.set(first, (freq.get(first) ?? 0) + 1)
    }
    const topNames = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)

    return { totalKids, totalFamilies, timeline, demography, topNames }
  }, [allKids, activeWeekends, data.parents, data.schoolYear, data.transitionMoments])

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Klassen</h2>
          <p className="text-sm text-gray-500">
            Voeg alle klassen toe die gepoetst moeten worden.
            De volgorde hier bepaalt de kolomvolgorde in het rooster.
          </p>
        </div>
        {data.classes.length > 1 && (
          <button
            onClick={autoSort}
            className="shrink-0 text-xs text-brand-600 hover:text-brand-800 border border-brand-200 hover:border-brand-400 bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-lg transition-colors"
            title="Peuter → Kleuter → Lager, daarna op nummer"
          >
            ↕ Auto-sorteren
          </button>
        )}
      </div>

      {/* Add form */}
      <div className="flex gap-2">
        <input
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          placeholder="Naam van de klas, bv. Peuterklas juf Sofie"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <button
          onClick={add}
          className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          + Toevoegen
        </button>
      </div>

      {/* List */}
      {data.classes.length === 0 ? (
        <p className="text-sm text-gray-400 italic">Nog geen klassen.</p>
      ) : (
        <ul className="space-y-2">
          {data.classes.map((cls, i) => {
            const kidCount = data.parents.flatMap((p) => p.kids).filter((k) => k.classId === cls.id).length
            return (
              <li key={cls.id} className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
                {/* Up/down arrows */}
                <div className="flex flex-col -my-1">
                  <button
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    className="text-gray-300 hover:text-gray-600 disabled:opacity-0 leading-none text-xs px-0.5"
                    title="Omhoog"
                  >
                    ▲
                  </button>
                  <button
                    onClick={() => move(i, 1)}
                    disabled={i === data.classes.length - 1}
                    className="text-gray-300 hover:text-gray-600 disabled:opacity-0 leading-none text-xs px-0.5"
                    title="Omlaag"
                  >
                    ▼
                  </button>
                </div>

                {/* Rank badge */}
                <span className="text-xs text-gray-300 w-5 text-center select-none">{i + 1}</span>

                <input
                  className="flex-1 text-sm bg-transparent focus:outline-none focus:ring-1 focus:ring-brand-400 rounded px-1"
                  value={cls.name}
                  onChange={(e) => rename(cls, e.target.value)}
                />
                <span className="text-xs text-gray-400 whitespace-nowrap">
                  {kidCount} {kidCount === 1 ? 'kind' : 'kinderen'}
                </span>
                <button
                  onClick={() => remove(cls.id)}
                  className="text-gray-300 hover:text-red-500 transition-colors text-lg leading-none"
                  title="Verwijderen"
                >
                  ×
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {/* ── School statistics ───────────────────────────────────────────────── */}
      {stats && (
        <div className="space-y-5 border-t border-gray-100 pt-5">

          {/* Totals */}
          <div className="flex items-baseline gap-4 flex-wrap">
            <div>
              <span className="text-3xl font-bold text-gray-900">{stats.totalKids}</span>
              <span className="text-sm text-gray-500 ml-1.5">kinderen</span>
            </div>
            <span className="text-gray-300 text-lg">·</span>
            <div>
              <span className="text-3xl font-bold text-gray-900">{stats.totalFamilies}</span>
              <span className="text-sm text-gray-500 ml-1.5">families</span>
            </div>
          </div>

          {/* Year timeline — only if there are mid-year transitions */}
          {stats.timeline.length > 1 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                Doorheen het jaar
              </p>
              <div className="space-y-1.5">
                {stats.timeline.map((ph, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="text-gray-500 w-44 shrink-0">{ph.label}</span>
                    <span className="font-semibold text-gray-900 w-7 text-right tabular-nums">
                      {ph.count}
                    </span>
                    {ph.delta !== null && ph.delta > 0 && (
                      <span className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-full px-1.5 py-0.5">
                        +{ph.delta}
                      </span>
                    )}
                    {ph.delta !== null && ph.delta < 0 && (
                      <span className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-full px-1.5 py-0.5">
                        {ph.delta}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sibling demography */}
          {stats.demography.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                Gezinssamenstelling
              </p>
              <div className="space-y-2">
                {(() => {
                  const maxCount = Math.max(...stats.demography.map(([, c]) => c))
                  return stats.demography.map(([kids, count]) => (
                    <div key={kids} className="flex items-center gap-2 text-sm">
                      <span className="text-gray-500 w-24 shrink-0 text-right">
                        {kids} {kids === 1 ? 'kind' : 'kinderen'}
                      </span>
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-brand-400 rounded-full"
                          style={{ width: `${(count / maxCount) * 100}%` }}
                        />
                      </div>
                      <span className="text-gray-600 font-medium w-5 text-right tabular-nums">
                        {count}
                      </span>
                    </div>
                  ))
                })()}
              </div>
            </div>
          )}

          {/* Top 5 names */}
          {stats.topNames.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                Populairste namen 🎉
              </p>
              <div className="flex flex-wrap gap-2">
                {stats.topNames.map(([name, count]) => (
                  <span
                    key={name}
                    className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-full px-3 py-1 text-sm"
                  >
                    <span className="font-medium text-gray-800">{name}</span>
                    {count > 1 && (
                      <span className="text-xs text-gray-400">{count}×</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  )
}
