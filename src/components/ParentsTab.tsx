import { useState, useMemo } from 'react'
import { useStore } from '../store'
import type { Parent } from '../types'
import { classSortKey } from '../utils/sortClasses'
import { resolveWeekends, effectiveKidCount } from '../algorithm'

function uid() { return crypto.randomUUID() }

type SortBy = 'parent' | 'kid'

export default function ParentsTab() {
  const { data, update } = useStore()
  const [parentName,    setParentName]    = useState('')
  const [searchQuery,   setSearchQuery]   = useState('')
  const [filterClassId, setFilterClassId] = useState('')
  const [sortBy,        setSortBy]        = useState<SortBy>('parent')

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

  const addKid = (
    parentId: string,
    kidName: string,
    classId: string,
    activeFrom?: string,
    activeTo?: string,
  ) => {
    update((d) => {
      const p = d.parents.find((p) => p.id === parentId)
      if (p) p.kids.push({
        id: uid(),
        name: kidName,
        classId,
        ...(activeFrom ? { activeFrom } : {}),
        ...(activeTo   ? { activeTo }   : {}),
      })
    })
  }

  const removeKid = (parentId: string, kidId: string) => {
    update((d) => {
      const p = d.parents.find((p) => p.id === parentId)
      if (p) p.kids = p.kids.filter((k) => k.id !== kidId)
    })
  }

  const updateKid = (parentId: string, kidId: string, activeFrom: string, activeTo: string) => {
    update((d) => {
      const p = d.parents.find((p) => p.id === parentId)
      const k = p?.kids.find((k) => k.id === kidId)
      if (!k) return
      k.activeFrom = activeFrom || undefined
      k.activeTo   = activeTo   || undefined
    })
  }

  /**
   * Create a "transition kid" entry in the target class for the same child.
   * Called when a peuter moves to a kleuterklas: sets up the new class slot
   * with activeFrom = the source kid's activeTo so the parent is scheduled
   * in the new class from the transition date onwards.
   */
  const addTransitionKid = (parentId: string, kidId: string, targetClassId: string) => {
    update((d) => {
      const p = d.parents.find((p) => p.id === parentId)
      if (!p) return
      const source = p.kids.find((k) => k.id === kidId)
      if (!source?.activeTo) return
      // Avoid duplicate if already created
      const exists = p.kids.some(
        (k) => k.classId === targetClassId && k.activeFrom === source.activeTo,
      )
      if (!exists) {
        p.kids.push({ id: uid(), name: source.name, classId: targetClassId, activeFrom: source.activeTo })
      }
    })
  }

  // ── Sorted classes for filter bar ─────────────────────────────────────────

  const sortedClasses = useMemo(
    () => data.classes.slice().sort((a, b) => classSortKey(a.name).localeCompare(classSortKey(b.name))),
    [data.classes],
  )

  const activeWeekends = useMemo(
    () => resolveWeekends(data).filter((w) => !w.skipped),
    [data.schoolYear, data.holidays, data.weekendOverrides, data.defaultAvailableDays],
  )

  const effectiveKidsMap = useMemo(
    () => new Map(data.parents.map((p) => [p.id, effectiveKidCount(p, activeWeekends)])),
    [data.parents, activeWeekends],
  )

  // ── Filtered + sorted parent list ─────────────────────────────────────────

  const filteredParents = useMemo(() => {
    let list = [...data.parents]

    // Text search — matches parent name or any kid name
    const q = searchQuery.trim().toLowerCase()
    if (q) {
      list = list.filter((p) =>
        p.name.toLowerCase().includes(q) ||
        p.kids.some((k) => k.name.toLowerCase().includes(q))
      )
    }

    // Class filter
    if (filterClassId) {
      list = list.filter((p) => p.kids.some((k) => k.classId === filterClassId))
    }

    // Sort
    list.sort((a, b) => {
      if (sortBy === 'parent') {
        const wordsA = a.name.split(' ')
        const wordsB = b.name.split(' ')
        const la = wordsA[wordsA.length - 1].toLowerCase()
        const lb = wordsB[wordsB.length - 1].toLowerCase()
        return la.localeCompare(lb, 'nl')
      } else {
        // When a class is filtered, sort by that specific kid's first name.
        // Otherwise sort by the alphabetically first kid name across all kids.
        const getKey = (p: Parent) => {
          const pool = filterClassId
            ? p.kids.filter((k) => k.classId === filterClassId)
            : p.kids
          const names = pool
            .map((k) => k.name.split(' ')[0].toLowerCase())
            .sort((x, y) => x.localeCompare(y, 'nl'))
          return names[0] ?? 'zzz'
        }
        return getKey(a).localeCompare(getKey(b), 'nl')
      }
    })

    return list
  }, [data.parents, searchQuery, filterClassId, sortBy])

  // ─────────────────────────────────────────────────────────────────────────

  if (data.classes.length === 0) {
    return (
      <div className="max-w-lg mx-auto">
        <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
          Voeg eerst klassen toe in het tabblad <strong>Klassen</strong>.
        </p>
      </div>
    )
  }

  const isFiltered = !!searchQuery.trim() || !!filterClassId

  return (
    <div className="max-w-2xl mx-auto space-y-5">
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

      {/* Search + sort */}
      {data.parents.length > 0 && (
        <div className="space-y-2">
          <div className="flex gap-2 flex-wrap items-center">
            {/* Search */}
            <div className="relative flex-1 min-w-48">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">🔍</span>
              <input
                className="w-full border border-gray-300 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="Zoek ouder of kind…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 text-lg leading-none"
                >
                  ×
                </button>
              )}
            </div>

            {/* Sort toggle */}
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
              {(['parent', 'kid'] as SortBy[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setSortBy(s)}
                  className={`px-3 py-2 transition-colors ${
                    sortBy === s
                      ? 'bg-brand-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {s === 'parent' ? 'Achternaam ouder' : 'Voornaam kind'}
                </button>
              ))}
            </div>
          </div>

          {/* Class filter chips */}
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => setFilterClassId('')}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                !filterClassId
                  ? 'bg-brand-600 text-white border-brand-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-brand-400'
              }`}
            >
              Alle klassen
            </button>
            {sortedClasses.map((cls) => (
              <button
                key={cls.id}
                onClick={() => setFilterClassId(filterClassId === cls.id ? '' : cls.id)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  filterClassId === cls.id
                    ? 'bg-brand-600 text-white border-brand-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-brand-400'
                }`}
              >
                {cls.name}
              </button>
            ))}
          </div>

          {/* Result count when filtering */}
          {isFiltered && (
            <p className="text-xs text-gray-400">
              {filteredParents.length} van {data.parents.length} ouders
            </p>
          )}
        </div>
      )}

      {/* Parent cards */}
      {data.parents.length === 0 ? (
        <p className="text-sm text-gray-400 italic">Nog geen ouders.</p>
      ) : filteredParents.length === 0 ? (
        <p className="text-sm text-gray-400 italic">Geen ouders gevonden.</p>
      ) : (
        <ul className="space-y-4">
          {filteredParents.map((parent) => (
            <ParentCard
              key={parent.id}
              parent={parent}
              classes={data.classes}
              transitionMoments={data.transitionMoments}
              focusClassId={filterClassId || undefined}
              effectiveKids={effectiveKidsMap.get(parent.id) ?? parent.kids.length}
              onRename={(name) => renameParent(parent.id, name)}
              onRemove={() => removeParent(parent.id)}
              onAddKid={(kidName, classId, activeFrom, activeTo) =>
                addKid(parent.id, kidName, classId, activeFrom, activeTo)
              }
              onRemoveKid={(kidId) => removeKid(parent.id, kidId)}
              onUpdateKid={(kidId, activeFrom, activeTo) =>
                updateKid(parent.id, kidId, activeFrom, activeTo)
              }
              onAddTransitionKid={(kidId, targetClassId) =>
                addTransitionKid(parent.id, kidId, targetClassId)
              }
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
  transitionMoments: { id: string; name: string; date: string }[]
  /** When set, renders the kid from this class as the card header. */
  focusClassId?: string
  /** Max simultaneously-active kids — used for weight display. */
  effectiveKids: number
  onRename: (name: string) => void
  onRemove: () => void
  onAddKid: (name: string, classId: string, activeFrom?: string, activeTo?: string) => void
  onRemoveKid: (kidId: string) => void
  onUpdateKid: (kidId: string, activeFrom: string, activeTo: string) => void
  /** Create a linked kid entry in targetClassId with activeFrom = source kid's activeTo. */
  onAddTransitionKid: (kidId: string, targetClassId: string) => void
}

function ParentCard({
  parent, classes, transitionMoments, focusClassId, effectiveKids,
  onRename, onRemove, onAddKid, onRemoveKid, onUpdateKid, onAddTransitionKid,
}: ParentCardProps) {
  const [kidName,          setKidName]          = useState('')
  const [classId,          setClassId]          = useState(classes[0]?.id ?? '')
  const [kidActiveFrom,    setKidActiveFrom]    = useState('')
  const [kidActiveTo,      setKidActiveTo]      = useState('')
  const [editKidId,        setEditKidId]        = useState<string | null>(null)
  const [transitionClassId, setTransitionClassId] = useState('')

  /** Toggle the edit panel; reset the transition class picker when switching kids. */
  const toggleEdit = (kidId: string) => {
    setEditKidId((prev) => (prev === kidId ? null : kidId))
    setTransitionClassId('')
  }

  const handleAddKid = () => {
    const name = kidName.trim()
    if (!name || !classId) return
    onAddKid(name, classId, kidActiveFrom || undefined, kidActiveTo || undefined)
    setKidName('')
    setKidActiveFrom('')
    setKidActiveTo('')
  }

  const weight        = effectiveKids > 0 ? (1 / effectiveKids).toFixed(2) : '—'
  const hasTransitions = transitionMoments.length > 0
  const sortedMoments  = transitionMoments.slice().sort((a, b) => a.date.localeCompare(b.date))

  // Split kids into focused (in filter class) vs siblings
  const focusedKids = focusClassId ? parent.kids.filter((k) => k.classId === focusClassId) : []
  const siblingKids = focusClassId ? parent.kids.filter((k) => k.classId !== focusClassId) : parent.kids

  // ── Transition destination picker ─────────────────────────────────────────
  /**
   * Shows below the "Actief tot" select whenever a departure date is set.
   * - If a linked kid already exists in another class with activeFrom === activeTo → green confirmation.
   * - Otherwise → amber picker + "Aanmaken" button to create the new kid entry.
   */
  const renderTransitionUI = (kid: Parent['kids'][0]) => {
    if (!kid.activeTo) return null

    const linked = parent.kids.find(
      (k) => k.id !== kid.id && k.activeFrom === kid.activeTo,
    )
    if (linked) {
      const linkedClass = classes.find((c) => c.id === linked.classId)
      return (
        <div className="w-full flex items-center gap-1.5 text-xs text-green-700">
          <span>✓ Verhuist naar <strong>{linkedClass?.name ?? '?'}</strong></span>
        </div>
      )
    }

    const otherClasses = classes.filter((c) => c.id !== kid.classId)
    return (
      <div className="w-full flex items-center gap-1.5 flex-wrap text-xs text-amber-700">
        <span className="shrink-0">→ Nieuwe klas:</span>
        <select
          className="border border-amber-300 bg-amber-50 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400"
          value={transitionClassId}
          onChange={(e) => setTransitionClassId(e.target.value)}
        >
          <option value="">— verplicht te kiezen —</option>
          {otherClasses.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {transitionClassId && (
          <button
            onClick={() => {
              onAddTransitionKid(kid.id, transitionClassId)
              setTransitionClassId('')
            }}
            className="shrink-0 bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-300 rounded px-2 py-0.5 transition-colors"
          >
            Aanmaken
          </button>
        )}
      </div>
    )
  }

  // ── Kid row (reused in both sections) ──────────────────────────────────────
  const renderKidRow = (kid: Parent['kids'][0], variant: 'focused' | 'sibling') => {
    const cls        = classes.find((c) => c.id === kid.classId)
    const isEditing  = editKidId === kid.id
    const fromMoment = transitionMoments.find((m) => m.date === kid.activeFrom)
    const toMoment   = transitionMoments.find((m) => m.date === kid.activeTo)

    return (
      <li key={kid.id} className={`border rounded-lg px-3 py-1.5 text-xs ${
        variant === 'focused'
          ? 'bg-white border-gray-200'
          : 'bg-gray-50 border-gray-200'
      }`}>
        <div className="flex items-center gap-1.5 flex-wrap">
          {variant === 'sibling' && (
            <span className="font-medium text-gray-900">{kid.name}</span>
          )}
          <span className={variant === 'sibling' ? 'text-gray-400' : 'text-gray-500'}>
            {variant === 'sibling' ? '· ' : ''}{cls?.name ?? '?'}
          </span>
          {fromMoment && (
            <span className="bg-green-50 text-green-700 border border-green-200 rounded-full px-1.5 py-0.5">
              ↳ {fromMoment.name}
            </span>
          )}
          {toMoment && (
            <span className="bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-1.5 py-0.5">
              → {toMoment.name}
            </span>
          )}
          <div className="ml-auto flex items-center gap-1.5">
            {hasTransitions && (
              <button
                onClick={() => toggleEdit(kid.id)}
                title="Overgangsperiode instellen"
                className={`transition-colors text-sm ${
                  isEditing ? 'text-brand-500' : 'text-gray-300 hover:text-brand-500'
                }`}
              >
                ✎
              </button>
            )}
            <button
              onClick={() => onRemoveKid(kid.id)}
              className="text-gray-300 hover:text-red-500 transition-colors"
            >
              ×
            </button>
          </div>
        </div>

        {isEditing && (
          <div className="mt-2 pt-2 border-t border-gray-200 flex gap-3 flex-wrap items-center text-gray-500">
            <label className="flex items-center gap-1">
              <span>Actief vanaf:</span>
              <select
                className="border border-gray-200 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand-400"
                value={kid.activeFrom ?? ''}
                onChange={(e) => onUpdateKid(kid.id, e.target.value, kid.activeTo ?? '')}
              >
                <option value="">— begin schooljaar</option>
                {sortedMoments.map((m) => (
                  <option key={m.id} value={m.date}>{m.name}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1">
              <span>Actief tot:</span>
              <select
                className="border border-gray-200 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand-400"
                value={kid.activeTo ?? ''}
                onChange={(e) => onUpdateKid(kid.id, kid.activeFrom ?? '', e.target.value)}
              >
                <option value="">— einde schooljaar</option>
                {sortedMoments.map((m) => (
                  <option key={m.id} value={m.date}>{m.name}</option>
                ))}
              </select>
            </label>
            {renderTransitionUI(kid)}
          </div>
        )}
      </li>
    )
  }

  // ── Add kid form ───────────────────────────────────────────────────────────
  const addKidForm = (
    <div className="space-y-2">
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

      {hasTransitions && (
        <div className="flex gap-3 flex-wrap items-center text-xs text-gray-500">
          <label className="flex items-center gap-1">
            <span>Actief vanaf:</span>
            <select
              className="border border-gray-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-brand-400"
              value={kidActiveFrom}
              onChange={(e) => setKidActiveFrom(e.target.value)}
            >
              <option value="">— begin schooljaar</option>
              {sortedMoments.map((m) => (
                <option key={m.id} value={m.date}>{m.name}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1">
            <span>Actief tot:</span>
            <select
              className="border border-gray-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-brand-400"
              value={kidActiveTo}
              onChange={(e) => setKidActiveTo(e.target.value)}
            >
              <option value="">— einde schooljaar</option>
              {sortedMoments.map((m) => (
                <option key={m.id} value={m.date}>{m.name}</option>
              ))}
            </select>
          </label>
        </div>
      )}
    </div>
  )

  // ── Focused layout (class filter active) ──────────────────────────────────
  if (focusClassId && focusedKids.length > 0) {
    return (
      <li className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        {/* Kid(s) from focused class as card header */}
        {focusedKids.map((kid) => (
          <div key={kid.id}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-base font-bold text-gray-900">{kid.name}</div>
                <div className="text-xs text-gray-400 mt-0.5">{parent.name}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs bg-brand-50 text-brand-700 border border-brand-200 rounded-full px-2 py-0.5">
                  gewicht {weight}
                </span>
                {hasTransitions && (
                  <button
                    onClick={() => toggleEdit(kid.id)}
                    title="Overgangsperiode instellen"
                    className={`transition-colors text-sm ${
                      editKidId === kid.id ? 'text-brand-500' : 'text-gray-300 hover:text-brand-500'
                    }`}
                  >
                    ✎
                  </button>
                )}
                <button
                  onClick={() => onRemoveKid(kid.id)}
                  className="text-gray-300 hover:text-red-500 transition-colors"
                  title="Kind verwijderen"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Transition badges under kid name */}
            {(() => {
              const fromMoment = transitionMoments.find((m) => m.date === kid.activeFrom)
              const toMoment   = transitionMoments.find((m) => m.date === kid.activeTo)
              return (fromMoment || toMoment) ? (
                <div className="flex gap-1.5 mt-1 flex-wrap">
                  {fromMoment && (
                    <span className="text-xs bg-green-50 text-green-700 border border-green-200 rounded-full px-1.5 py-0.5">
                      ↳ {fromMoment.name}
                    </span>
                  )}
                  {toMoment && (
                    <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-1.5 py-0.5">
                      → {toMoment.name}
                    </span>
                  )}
                </div>
              ) : null
            })()}

            {/* Transition edit panel */}
            {editKidId === kid.id && (
              <div className="mt-2 pt-2 border-t border-gray-200 flex gap-3 flex-wrap items-center text-xs text-gray-500">
                <label className="flex items-center gap-1">
                  <span>Actief vanaf:</span>
                  <select
                    className="border border-gray-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-brand-400"
                    value={kid.activeFrom ?? ''}
                    onChange={(e) => onUpdateKid(kid.id, e.target.value, kid.activeTo ?? '')}
                  >
                    <option value="">— begin schooljaar</option>
                    {sortedMoments.map((m) => (
                      <option key={m.id} value={m.date}>{m.name}</option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-1">
                  <span>Actief tot:</span>
                  <select
                    className="border border-gray-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-brand-400"
                    value={kid.activeTo ?? ''}
                    onChange={(e) => onUpdateKid(kid.id, kid.activeFrom ?? '', e.target.value)}
                  >
                    <option value="">— einde schooljaar</option>
                    {sortedMoments.map((m) => (
                      <option key={m.id} value={m.date}>{m.name}</option>
                    ))}
                  </select>
                </label>
                {renderTransitionUI(kid)}
              </div>
            )}
          </div>
        ))}

        {/* Siblings */}
        {siblingKids.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-xs text-gray-400 font-medium uppercase tracking-wide">
              Brussen
            </div>
            <ul className="space-y-1.5">
              {siblingKids.map((kid) => renderKidRow(kid, 'sibling'))}
            </ul>
          </div>
        )}

        {/* Add kid form */}
        {addKidForm}
      </li>
    )
  }

  // ── Default layout (no class filter) ──────────────────────────────────────
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

      {/* All kids */}
      {parent.kids.length > 0 && (
        <ul className="space-y-1.5">
          {parent.kids.map((kid) => renderKidRow(kid, 'sibling'))}
        </ul>
      )}

      {/* Add kid form */}
      {addKidForm}
    </li>
  )
}
