/**
 * ImportTab — import a student list from .xlsx, .xls or .csv
 *
 * Flow:
 *  1. Drop / pick a file
 *  2. Preview first rows + map columns  (kid name, class name, parent name)
 *  3. Click "Importeren" → classes & parents are created/merged
 */

import { useCallback, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import Papa from 'papaparse'
import { useStore } from '../store'
import { sortClasses } from '../utils/sortClasses'

function uid() { return crypto.randomUUID() }

// ─── Types ────────────────────────────────────────────────────────────────────

type Row = Record<string, string>

interface ParsedFile {
  headers: string[]
  rows: Row[]     // all rows
  preview: Row[]  // first 6 rows for the UI
}

interface ColumnMap {
  kid: string
  class: string
  parent: string
}

type ImportMode = 'merge' | 'replace'

interface ImportResult {
  classesAdded: number
  parentsAdded: number
  kidsAdded: number
  kidsSkipped: number
}

// ─── Parsing helpers ──────────────────────────────────────────────────────────

function parseXlsx(buffer: ArrayBuffer): ParsedFile {
  const wb = XLSX.read(buffer, { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const raw = XLSX.utils.sheet_to_json<Row>(sheet, { defval: '', raw: false })
  const headers = raw.length ? Object.keys(raw[0]) : []
  return { headers, rows: raw, preview: raw.slice(0, 6) }
}

function parseCsv(text: string): ParsedFile {
  const result = Papa.parse<Row>(text, { header: true, skipEmptyLines: true })
  const headers = result.meta.fields ?? []
  const rows = result.data
  return { headers, rows, preview: rows.slice(0, 6) }
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ImportTab() {
  const { update } = useStore()

  const [parsed, setParsed]     = useState<ParsedFile | null>(null)
  const [fileName, setFileName] = useState('')
  const [colMap, setColMap]     = useState<ColumnMap>({ kid: '', class: '', parent: '' })
  const [mode, setMode]         = useState<ImportMode>('merge')
  const [result, setResult]     = useState<ImportResult | null>(null)
  const [error, setError]       = useState('')
  const [dragging, setDragging] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)

  // ── File handling ──────────────────────────────────────────────────────────

  const handleFile = useCallback(async (file: File) => {
    setResult(null)
    setError('')
    setFileName(file.name)

    try {
      let pf: ParsedFile
      if (file.name.match(/\.csv$/i)) {
        const text = await file.text()
        pf = parseCsv(text)
      } else {
        const buf = await file.arrayBuffer()
        pf = parseXlsx(buf)
      }

      if (!pf.headers.length) throw new Error('Geen kolommen gevonden in het bestand.')
      setParsed(pf)

      // Auto-detect column mapping (case-insensitive fuzzy)
      const detect = (patterns: string[]): string =>
        pf.headers.find((h) =>
          patterns.some((p) => h.toLowerCase().includes(p))
        ) ?? ''

      setColMap({
        kid:    detect(['kind', 'leerling', 'voornaam', 'naam', 'name', 'student', 'child']),
        class:  detect(['klas', 'class', 'klass', 'groep', 'group', 'jaar']),
        parent: detect(['ouder', 'parent', 'familie', 'family', 'gezin']),
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Onbekende fout bij het lezen van het bestand.')
      setParsed(null)
    }
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  // ── Import ─────────────────────────────────────────────────────────────────

  const canImport = parsed && colMap.kid && colMap.class && colMap.parent

  const doImport = () => {
    if (!parsed || !canImport) return

    let classesAdded = 0
    let parentsAdded = 0
    let kidsAdded    = 0
    let kidsSkipped  = 0

    update((d) => {
      if (mode === 'replace') {
        d.classes = []
        d.parents = []
        d.assignments = []
      }

      for (const row of parsed.rows) {
        const kidName    = String(row[colMap.kid]   ?? '').trim()
        const className  = String(row[colMap.class] ?? '').trim()
        const parentName = String(row[colMap.parent] ?? '').trim()

        if (!kidName || !className || !parentName) { kidsSkipped++; continue }

        // Find or create class
        let cls = d.classes.find((c) => c.name.toLowerCase() === className.toLowerCase())
        if (!cls) {
          cls = { id: uid(), name: className }
          d.classes.push(cls)
          classesAdded++
        }

        // Find or create parent
        let parent = d.parents.find((p) => p.name.toLowerCase() === parentName.toLowerCase())
        if (!parent) {
          parent = { id: uid(), name: parentName, kids: [] }
          d.parents.push(parent)
          parentsAdded++
        }

        // Check for duplicate kid in same class for same parent
        const duplicate = parent.kids.some(
          (k) => k.name.toLowerCase() === kidName.toLowerCase() && k.classId === cls!.id
        )
        if (duplicate) { kidsSkipped++; continue }

        parent.kids.push({ id: uid(), name: kidName, classId: cls.id })
        kidsAdded++
      }

      // Auto-sort classes after import (Peuter → Kleuter → Lager → cijfer)
      sortClasses(d.classes)
    })

    setResult({ classesAdded, parentsAdded, kidsAdded, kidsSkipped })
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Leerlingenlijst importeren</h2>
        <p className="text-sm text-gray-500">
          Upload een exportbestand van de schooladministratie (.xlsx, .xls of .csv).
          Kies daarna welke kolom de naam van het kind, de klas en de ouder bevat.
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
          dragging
            ? 'border-brand-500 bg-brand-50'
            : 'border-gray-300 hover:border-brand-400 hover:bg-gray-50'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={onInputChange}
        />
        <div className="text-3xl mb-2">📂</div>
        <p className="text-sm font-medium text-gray-700">
          {fileName ? fileName : 'Sleep een bestand hierheen of klik om te kiezen'}
        </p>
        <p className="text-xs text-gray-400 mt-1">.xlsx · .xls · .csv</p>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>
      )}

      {/* Column mapping + preview */}
      {parsed && (
        <>
          {/* Mapping */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <h3 className="font-semibold text-gray-900 text-sm">Kolommen koppelen</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {(
                [
                  { key: 'kid',    label: '👦 Naam kind'   },
                  { key: 'class',  label: '🏫 Klas'        },
                  { key: 'parent', label: '👨‍👩‍👧 Naam ouder' },
                ] as { key: keyof ColumnMap; label: string }[]
              ).map(({ key, label }) => (
                <label key={key} className="flex flex-col gap-1 text-sm text-gray-600">
                  {label}
                  <select
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    value={colMap[key]}
                    onChange={(e) => setColMap((m) => ({ ...m, [key]: e.target.value }))}
                  >
                    <option value="">— kies kolom —</option>
                    {parsed.headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </div>

          {/* Preview table */}
          <div>
            <h3 className="font-semibold text-gray-900 text-sm mb-2">
              Voorbeeld ({parsed.rows.length} rijen gevonden)
            </h3>
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="min-w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {parsed.headers.map((h) => (
                      <th
                        key={h}
                        className={`px-3 py-2 text-left font-semibold whitespace-nowrap ${
                          Object.values(colMap).includes(h)
                            ? 'text-brand-700 bg-brand-50'
                            : 'text-gray-500'
                        }`}
                      >
                        {h}
                        {colMap.kid    === h && <span className="ml-1 text-brand-400">·kind</span>}
                        {colMap.class  === h && <span className="ml-1 text-brand-400">·klas</span>}
                        {colMap.parent === h && <span className="ml-1 text-brand-400">·ouder</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsed.preview.map((row, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                      {parsed.headers.map((h) => (
                        <td
                          key={h}
                          className={`px-3 py-2 whitespace-nowrap ${
                            Object.values(colMap).includes(h) ? 'font-medium text-gray-800' : 'text-gray-400'
                          }`}
                        >
                          {row[h]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Import mode + button */}
          <div className="flex items-center gap-4 flex-wrap">
            <fieldset className="flex gap-4 text-sm">
              {(
                [
                  { value: 'merge',   label: 'Samenvoegen met bestaande data' },
                  { value: 'replace', label: 'Bestaande data vervangen' },
                ] as { value: ImportMode; label: string }[]
              ).map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 cursor-pointer text-gray-700">
                  <input
                    type="radio"
                    name="mode"
                    value={opt.value}
                    checked={mode === opt.value}
                    onChange={() => setMode(opt.value)}
                    className="accent-brand-600"
                  />
                  {opt.label}
                </label>
              ))}
            </fieldset>

            <button
              onClick={doImport}
              disabled={!canImport}
              className="ml-auto bg-brand-600 hover:bg-brand-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-medium px-6 py-2.5 rounded-lg transition-colors"
            >
              ↑ Importeren
            </button>
          </div>
        </>
      )}

      {/* Result */}
      {result && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm space-y-1">
          <p className="font-semibold text-green-800">✓ Import geslaagd</p>
          <ul className="text-green-700 space-y-0.5">
            <li>{result.classesAdded} nieuwe klas{result.classesAdded !== 1 ? 'sen' : ''} aangemaakt</li>
            <li>{result.parentsAdded} nieuwe ouder{result.parentsAdded !== 1 ? 's' : ''} aangemaakt</li>
            <li>{result.kidsAdded} kind{result.kidsAdded !== 1 ? 'eren' : ''} toegevoegd</li>
            {result.kidsSkipped > 0 && (
              <li className="text-amber-700">{result.kidsSkipped} rijen overgeslagen (leeg of duplicaat)</li>
            )}
          </ul>
          <p className="text-green-600 text-xs mt-2">
            Ga naar <strong>Ouders</strong> of <strong>Klassen</strong> om de import te controleren.
          </p>
        </div>
      )}
    </div>
  )
}
