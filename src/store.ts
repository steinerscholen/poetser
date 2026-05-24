/**
 * App-wide state backed by localStorage.
 * All mutations go through the `update` function.
 */

import React, { createContext, useContext, useState, useCallback } from 'react'
import type { AppData } from './types'
import { DEFAULT_DATA } from './types'

const STORAGE_KEY = 'poetser-v1'

function load(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULT_DATA, ...JSON.parse(raw) }
  } catch {
    // ignore
  }
  return structuredClone(DEFAULT_DATA)
}

function save(data: AppData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface StoreCtx {
  data: AppData
  update: (fn: (draft: AppData) => void) => void
  reset: () => void
}

const Ctx = createContext<StoreCtx | null>(null)

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData>(load)

  const update = useCallback((fn: (draft: AppData) => void) => {
    setData((prev) => {
      const next = structuredClone(prev)
      fn(next)
      save(next)
      return next
    })
  }, [])

  const reset = useCallback(() => {
    const fresh = structuredClone(DEFAULT_DATA)
    save(fresh)
    setData(fresh)
  }, [])

  return React.createElement(Ctx.Provider, { value: { data, update, reset } }, children)
}

export function useStore(): StoreCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useStore must be used inside StoreProvider')
  return ctx
}
