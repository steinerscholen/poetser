import { useState } from 'react'
import { useStore } from '../store'
import type { Parent } from '../types'

function uid() { return crypto.randomUUID() }

export default function ParentsTab() {
  const { data, update } = useStore()
  const [parentName, setParentName] = useState('')

  const addParent = () => {
    const name = parentName.trim()
    if (!name) return
    update((d) => { d.parents.push({ id: uid(), name, kids: [] }) })
    setParentName('')
  }

  const removeParent = (id: string) => {
    update((d) => { d.parents = d.parents.filter((p) => p.id !== id) })
  }

  const renameParent = (id: string, name: string) => {
    update((d) => { const p = d.parents.find((p) => p.id === id); if (p) p.name = name })
  }

  const addKid = (parentId: string, kidName: string, classId: string) => {
    update((d) => {
      const p = d.parents.find((p) => p.id === parentId)
      if (p) p.kids.push({ id: uid(), name: kidName, classId })
    })
  }

  const removeKid = (parentId: string, kidId: string) => {
    update((d) => {
      const p = d.parents.find((p) => p.id === parentId)
      if (p) p.kids = p.kids.filter((k) => k.id !== kidId)
    })
  }

  if (data.classes.length === 0) {
    return (
      <div className="max-w-lg mx-auto">
        <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
          Voeg eerst klassen toe in het tabblad <strong>Klassen</strong>.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Ouders &amp; kinderen</h2>
        <p className="text-sm text-gray-500">
          Voeg elke ouder toe met hun kinderen en de bijhorende klas.
          Het gewicht voor de verdeling wordt automatisch berekend op basis van het aantal kinderen.
        </p>
      </div>

      {/* Add parent */}
      <div className="flex gap-2">
        <input
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          placeholder="Naam van de ouder, bv. De Smedt"
          value={parentName}
          onChange={(e) => setParentName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addParent()}
        />
        <button
          onClick={addParent}
          className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          + Ouder
        </button>
      </div>

      {/* Parent cards */}
      {data.parents.length === 0 ? (
        <p className="text-sm text-gray-400 italic">Nog geen ouders.</p>
      ) : (
        <ul className="space-y-4">
          {data.parents.map((parent) => (
            <ParentCard
              key={parent.id}
              parent={parent}
              classes={data.classes}
              onRename={(name) => renameParent(parent.id, name)}
              onRemove={() => removeParent(parent.id)}
              onAddKid={(kidName, classId) => addKid(parent.id, kidName, classId)}
              onRemoveKid={(kidId) => removeKid(parent.id, kidId)}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

// ─── Parent card ──────────────────────────────────────────────────────────────

interface ParentCardProps {
  parent: Parent
  classes: { id: string; name: string }[]
  onRename: (name: string) => void
  onRemove: () => void
  onAddKid: (name: string, classId: string) => void
  onRemoveKid: (kidId: string) => void
}

function ParentCard({ parent, classes, onRename, onRemove, onAddKid, onRemoveKid }: ParentCardProps) {
  const [kidName, setKidName] = useState('')
  const [classId, setClassId] = useState(classes[0]?.id ?? '')

  const handleAddKid = () => {
    const name = kidName.trim()
    if (!name || !classId) return
    onAddKid(name, classId)
    setKidName('')
  }

  const weight = parent.kids.length > 0 ? (1 / parent.kids.length).toFixed(2) : '—'

  return (
    <li className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      {/* Parent header */}
      <div className="flex items-center gap-2">
        <input
          className="flex-1 font-semibold text-gray-900 bg-transparent focus:outline-none focus:ring-1 focus:ring-brand-400 rounded px-1"
          value={parent.name}
          onChange={(e) => onRename(e.target.value)}
        />
        <span className="text-xs bg-brand-50 text-brand-700 border border-brand-200 rounded-full px-2 py-0.5">
          gewicht {weight}
        </span>
        <button
          onClick={onRemove}
          className="text-gray-300 hover:text-red-500 transition-colors text-lg leading-none"
        >
          ×
        </button>
      </div>

      {/* Kids */}
      {parent.kids.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {parent.kids.map((kid) => {
            const cls = classes.find((c) => c.id === kid.classId)
            return (
              <li
                key={kid.id}
                className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-full px-3 py-1 text-xs"
              >
                <span className="font-medium">{kid.name}</span>
                <span className="text-gray-400">· {cls?.name ?? '?'}</span>
                <button
                  onClick={() => onRemoveKid(kid.id)}
                  className="ml-1 text-gray-300 hover:text-red-500 transition-colors"
                >
                  ×
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {/* Add kid form */}
      <div className="flex gap-2">
        <input
          className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400"
          placeholder="Naam kind"
          value={kidName}
          onChange={(e) => setKidName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddKid()}
        />
        <select
          className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400"
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
        >
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <button
          onClick={handleAddKid}
          className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm px-3 py-1.5 rounded-lg transition-colors"
        >
          + Kind
        </button>
      </div>
    </li>
  )
}
