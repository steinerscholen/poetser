import { useState } from 'react'
import { useStore } from '../store'
import type { DaySlot, Holiday, WeekendOverride } from '../types'
import { DAY_LABELS } from '../types'
import { resolveWeekends } from '../algorithm'
import { fmtWeekend } from '../utils/dates'

function uid() { return crypto.randomUUID() }

const ALL_DAYS: DaySlot[] = ['friday', 'saturday', 'sunday']

export default function CalendarTab() {
  const { data, update } = useStore()

  // ─── School year ───────────────────────────────────────────────────────────

  const setYearField = (field: 'start' | 'end', value: string) => {
    update((d) => { d.schoolYear[field] = value })
  }

  // ─── Default days ──────────────────────────────────────────────────────────

  const toggleDefaultDay = (day: DaySlot) => {
    update((d) => {
      if (d.defaultAvailableDays.includes(day)) {
        d.defaultAvailableDays = d.defaultAvailableDays.filter((x) => x !== day)
      } else {
        d.defaultAvailableDays.push(day)
        d.defaultAvailableDays.sort((a, b) => ALL_DAYS.indexOf(a) - ALL_DAYS.indexOf(b))
      }
    })
  }

  // ─── Holidays ─────────────────────────────────────────────────────────────

  const [hName, setHName] = useState('')
  const [hStart, setHStart] = useState('')
  const [hEnd, setHEnd] = useState('')

  const addHoliday = () => {
    const name = hName.trim()
    if (!name || !hStart || !hEnd) return
    update((d) => { d.holidays.push({ id: uid(), name, startDate: hStart, endDate: hEnd }) })
    setHName(''); setHStart(''); setHEnd('')
  }

  const removeHoliday = (id: string) => {
    update((d) => { d.holidays = d.holidays.filter((h) => h.id !== id) })
  }

  const updateHoliday = (id: string, field: keyof Holiday, value: string) => {
    update((d) => {
      const h = d.holidays.find((h) => h.id === id)
      if (h) (h as unknown as Record<string, unknown>)[field] = value
    })
  }

  // ─── Weekend overrides ─────────────────────────────────────────────────────

  const resolved = resolveWeekends(data)

  const getOverride = (friday: string): WeekendOverride | undefined =>
    data.weekendOverrides.find((o) => o.fridayDate === friday)

  const setOverride = (friday: string, patch: Partial<WeekendOverride>) => {
    update((d) => {
      let ov = d.weekendOverrides.find((o) => o.fridayDate === friday)
      if (!ov) {
        // initialise from defaults
        ov = {
          fridayDate: friday,
          availableDays: [...d.defaultAvailableDays],
        }
        d.weekendOverrides.push(ov)
      }
      Object.assign(ov, patch)
    })
  }

  const clearOverride = (friday: string) => {
    update((d) => { d.weekendOverrides = d.weekendOverrides.filter((o) => o.fridayDate !== friday) })
  }

  const toggleOverrideDay = (friday: string, day: DaySlot) => {
    const current = getOverride(friday)?.availableDays ?? [...data.defaultAvailableDays]
    const next = current.includes(day) ? current.filter((d) => d !== day) : [...current, day].sort((a, b) => ALL_DAYS.indexOf(a) - ALL_DAYS.indexOf(b))
    setOverride(friday, { availableDays: next, forcedDay: undefined })
  }

  const setForcedDay = (friday: string, day: DaySlot | '') => {
    setOverride(friday, { forcedDay: day === '' ? undefined : day })
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* School year */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Schooljaar</h2>
        <div className="flex gap-4 flex-wrap">
          <label className="flex flex-col gap-1 text-sm text-gray-600">
            Start
            <input
              type="date"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              value={data.schoolYear.start}
              onChange={(e) => setYearField('start', e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-gray-600">
            Einde
            <input
              type="date"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              value={data.schoolYear.end}
              onChange={(e) => setYearField('end', e.target.value)}
            />
          </label>
        </div>
      </section>

      {/* Default available days */}
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Standaard poetsdag</h2>
          <p className="text-sm text-gray-500">Welke dag(en) is poetsen standaard mogelijk elk weekend?</p>
        </div>
        <div className="flex gap-2">
          {ALL_DAYS.map((day) => (
            <button
              key={day}
              onClick={() => toggleDefaultDay(day)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                data.defaultAvailableDays.includes(day)
                  ? 'bg-brand-600 text-white border-brand-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-brand-400'
              }`}
            >
              {DAY_LABELS[day]}
            </button>
          ))}
        </div>
      </section>

      {/* Holidays */}
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Vakanties &amp; schoolvrije periodes</h2>
          <p className="text-sm text-gray-500">
            Weekenden die volledig in een vakantie vallen worden automatisch overgeslagen.
            Gedeeltelijke weekenden behouden de beschikbare dag(en) buiten de vakantie.
          </p>
        </div>

        {/* Add holiday form */}
        <div className="flex gap-2 flex-wrap">
          <input
            className="flex-1 min-w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            placeholder="Naam vakantie"
            value={hName}
            onChange={(e) => setHName(e.target.value)}
          />
          <input type="date" className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" value={hStart} onChange={(e) => setHStart(e.target.value)} />
          <input type="date" className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" value={hEnd} onChange={(e) => setHEnd(e.target.value)} />
          <button
            onClick={addHoliday}
            className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            + Vakantie
          </button>
        </div>

        {data.holidays.length === 0 ? (
          <p className="text-sm text-gray-400 italic">Geen vakanties ingesteld.</p>
        ) : (
          <ul className="space-y-2">
            {data.holidays
              .slice()
              .sort((a, b) => a.startDate.localeCompare(b.startDate))
              .map((h) => (
                <li key={h.id} className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
                  <input
                    className="flex-1 text-sm bg-transparent focus:outline-none"
                    value={h.name}
                    onChange={(e) => updateHoliday(h.id, 'name', e.target.value)}
                  />
                  <input type="date" className="border border-gray-200 rounded px-2 py-1 text-xs" value={h.startDate} onChange={(e) => updateHoliday(h.id, 'startDate', e.target.value)} />
                  <span className="text-gray-400 text-xs">→</span>
                  <input type="date" className="border border-gray-200 rounded px-2 py-1 text-xs" value={h.endDate} onChange={(e) => updateHoliday(h.id, 'endDate', e.target.value)} />
                  <button onClick={() => removeHoliday(h.id)} className="text-gray-300 hover:text-red-500 transition-colors text-lg leading-none">×</button>
                </li>
              ))}
          </ul>
        )}
      </section>

      {/* Weekend overrides */}
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Weekendbeheer</h2>
          <p className="text-sm text-gray-500">
            Pas per weekend de beschikbare dag(en) aan of blokkeer een specifieke dag.
            Laat leeg = standaardinstellingen.
          </p>
        </div>

        <div className="space-y-2">
          {resolved.map((w) => {
            const ov = getOverride(w.fridayDate)
            const isCustom = !!ov
            const effectiveDays = w.availableDays

            return (
              <div
                key={w.fridayDate}
                className={`border rounded-lg px-4 py-3 ${
                  w.skipped
                    ? 'bg-gray-50 border-gray-200 opacity-60'
                    : isCustom
                    ? 'bg-amber-50 border-amber-300'
                    : 'bg-white border-gray-200'
                }`}
              >
                <div className="flex items-start gap-3 flex-wrap">
                  {/* Date */}
                  <div className="min-w-28">
                    <div className="text-sm font-medium text-gray-900">{fmtWeekend(w.fridayDate)}</div>
                    {w.isHoliday && (
                      <div className="text-xs text-amber-600">{w.holidayName}</div>
                    )}
                    {w.skipped && <div className="text-xs text-gray-400">overgeslagen</div>}
                  </div>

                  {/* Day toggles */}
                  <div className="flex gap-1">
                    {ALL_DAYS.map((day) => {
                      const active = effectiveDays.includes(day)
                      const forced = ov?.forcedDay === day
                      return (
                        <button
                          key={day}
                          onClick={() => toggleOverrideDay(w.fridayDate, day)}
                          className={`px-2 py-1 rounded text-xs font-medium border transition-colors ${
                            forced
                              ? 'bg-green-600 text-white border-green-600'
                              : active
                              ? 'bg-brand-600 text-white border-brand-600'
                              : 'bg-white text-gray-400 border-gray-200'
                          }`}
                        >
                          {DAY_LABELS[day].slice(0, 3)}
                        </button>
                      )
                    })}
                  </div>

                  {/* Forced day */}
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <span>Verplicht:</span>
                    <select
                      className="border border-gray-200 rounded px-1 py-0.5 text-xs"
                      value={ov?.forcedDay ?? ''}
                      onChange={(e) => setForcedDay(w.fridayDate, e.target.value as DaySlot | '')}
                    >
                      <option value="">—</option>
                      {effectiveDays.map((day) => (
                        <option key={day} value={day}>{DAY_LABELS[day]}</option>
                      ))}
                    </select>
                  </div>

                  {/* Reset button */}
                  {isCustom && (
                    <button
                      onClick={() => clearOverride(w.fridayDate)}
                      className="ml-auto text-xs text-gray-400 hover:text-gray-700 underline"
                    >
                      Herstellen
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
