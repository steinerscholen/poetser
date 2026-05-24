import { useState } from 'react'
import { useStore } from '../store'
import type { SchoolClass } from '../types'
import { sortClasses } from '../utils/sortClasses'

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
    </div>
  )
}
