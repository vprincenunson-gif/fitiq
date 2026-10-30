import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Vibe } from '../services/recommend'

const HISTORY_KEY = 'fitiq.outfit.history.v1'
const MAX_ENTRIES = 20

export interface HistoryEntry {
  id: string
  /** Canonical order: [top, bottom, shoes]. */
  garmentIds: string[]
  vibe: Vibe
  createdAt: string
}

interface OutfitHistoryContextValue {
  history: HistoryEntry[]
  record: (vibe: Vibe, garmentIds: string[]) => void
  remove: (id: string) => void
  /** Replace history (used when restoring guest data). */
  hydrateHistory: (entries: HistoryEntry[]) => void
}

const OutfitHistoryContext = createContext<OutfitHistoryContextValue | null>(null)

function readEntries(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as HistoryEntry[]
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (e) =>
          e &&
          typeof e.id === 'string' &&
          Array.isArray(e.garmentIds) &&
          typeof e.vibe === 'string' &&
          typeof e.createdAt === 'string',
      )
    }
    return []
  } catch {
    return []
  }
}

const sameCombo = (a: string[], b: string[]) =>
  a.length === b.length && a.every((id, i) => id === b[i])

export function OutfitHistoryProvider({ children }: { children: ReactNode }) {
  const [history, setHistory] = useState<HistoryEntry[]>(readEntries)

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
    } catch {
      /* storage unavailable */
    }
  }, [history])

  const record = useCallback((vibe: Vibe, garmentIds: string[]) => {
    const ids = garmentIds.filter(Boolean)
    if (ids.length === 0) return
    setHistory((prev) => {
      // Skip exact duplicates (most recent first); keep newest on top.
      const withoutDup = prev.filter((e) => !sameCombo(e.garmentIds, ids))
      return [
        { id: `hist_${crypto.randomUUID()}`, garmentIds: ids, vibe, createdAt: new Date().toISOString() },
        ...withoutDup,
      ].slice(0, MAX_ENTRIES)
    })
  }, [])

  const remove = useCallback((id: string) => {
    setHistory((prev) => prev.filter((e) => e.id !== id))
  }, [])

  const value = useMemo(
    () => ({ history, record, remove, hydrateHistory: setHistory }),
    [history, record, remove],
  )

  return <OutfitHistoryContext.Provider value={value}>{children}</OutfitHistoryContext.Provider>
}

export function useOutfitHistory(): OutfitHistoryContextValue {
  const ctx = useContext(OutfitHistoryContext)
  if (!ctx) throw new Error('useOutfitHistory must be used within OutfitHistoryProvider')
  return ctx
}
