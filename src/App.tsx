import { useState } from 'react'
import { StoreProvider, useStore } from './store'
import ClassesTab from './components/ClassesTab'
import ParentsTab from './components/ParentsTab'
import CalendarTab from './components/CalendarTab'
import ScheduleTab from './components/ScheduleTab'
import ImportTab from './components/ImportTab'
import { version } from '../package.json'

type Tab = 'import' | 'classes' | 'parents' | 'calendar' | 'schedule'

const TABS: { id: Tab; label: string; emoji: string }[] = [
  { id: 'import',   label: 'Importeren',  emoji: '📥' },
  { id: 'classes',  label: 'Klassen',     emoji: '🏫' },
  { id: 'parents',  label: 'Ouders',      emoji: '👨‍👩‍👧' },
  { id: 'calendar', label: 'Kalender',    emoji: '📅' },
  { id: 'schedule', label: 'Rooster',     emoji: '📋' },
]

function Shell() {
  const [tab, setTab] = useState<Tab>('import')
  const { data, reset } = useStore()

  const classCount   = data.classes.length
  const parentCount  = data.parents.length
  const hasSchedule  = data.assignments.length > 0

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4 print:hidden">
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">🧹 Poetser</h1>
          <p className="text-xs text-gray-400">Schoolpoetsrooster – {data.schoolYear.start.slice(0, 4)}/{data.schoolYear.end.slice(0, 4)}</p>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span>{classCount} klassen</span>
          <span>{parentCount} ouders</span>
          {hasSchedule && <span className="text-green-600 font-medium">✓ rooster gegenereerd</span>}
        </div>
        <button
          onClick={() => { if (confirm('Alles wissen en opnieuw beginnen?')) reset() }}
          className="text-xs text-gray-400 hover:text-red-500 transition-colors"
        >
          Reset
        </button>
      </header>

      {/* Tabs */}
      <nav className="bg-white border-b border-gray-200 px-6 flex gap-1 print:hidden">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <span className="mr-1.5">{t.emoji}</span>
            {t.label}
          </button>
        ))}
      </nav>

      {/* Content */}
      <main className="flex-1 px-6 py-8">
        {tab === 'import'   && <ImportTab />}
        {tab === 'classes'  && <ClassesTab />}
        {tab === 'parents'  && <ParentsTab />}
        {tab === 'calendar' && <CalendarTab />}
        {tab === 'schedule' && <ScheduleTab />}
      </main>

      {/* Print header (only visible when printing) */}
      <div className="hidden print:block text-center mb-6">
        <h1 className="text-2xl font-bold">Poetsrooster {data.schoolYear.start.slice(0, 4)}/{data.schoolYear.end.slice(0, 4)}</h1>
        <p className="text-sm text-gray-500">Steinerschool Gent</p>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-3 px-6 flex items-center justify-center gap-2.5 text-xs text-gray-400 print:hidden">
        {/* Ghent 3-tower skyline: Sint-Niklaas · Belfort · Sint-Baafs */}
        <svg viewBox="0 0 90 36" height="18" fill="currentColor" aria-hidden="true" className="shrink-0 opacity-70">
          <path d="M0 36V22h3V14h2V8l4-8 4 8v6h2v8h3v14Z" />
          <rect x="29" y="8" width="32" height="28" />
          <rect x="25" y="2" width="8"  height="8" />
          <rect x="41" y="0" width="8"  height="8" />
          <rect x="57" y="2" width="8"  height="8" />
          <path d="M72 36V20h2V12h2V6l5-6 5 6v6h2v8h2v16Z" />
        </svg>
        <span>Gemaakt in Gent</span>
        <span className="text-gray-300">·</span>
        <a
          href="https://github.com/tngvndrm"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-gray-600 transition-colors"
        >
          tngvndrm
        </a>
        <span className="text-gray-300">·</span>
        <span>v{version}</span>
      </footer>
    </div>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  )
}
