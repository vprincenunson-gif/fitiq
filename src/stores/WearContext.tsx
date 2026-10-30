import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useWardrobe } from './WardrobeContext'
import { garmentWearCount } from '../lib/types'

/* ────────────────────────────────────────────────────────────────────────
   Smart Wear Tracking.

   A tiny local log of confirmed wears. Marking a look as worn happens only
   after the user confirms it in the UI; that is the single place wear stats
   and Wear Status change. Per-garment totals (`wearCount`, `lastWornAt`)
   live on the garment itself in the wardrobe store, while this log keeps one
   entry per wear event so a planned day or saved look can't be counted twice
   and the UI can show what was already worn.
   ──────────────────────────────────────────────────────────────────────── */

const LOG_KEY = 'fitiq.wear.log.v1'
const MAX_ENTRIES = 200

export interface WearLogEntry {
  id: string
  /** Local calendar day the look was worn (YYYY-MM-DD). */
  dateKey: string
  /** ISO timestamp of the confirmation. */
  wornAt: string
  /** Canonical [top, bottom, shoes] ids at wear time. */
  garmentIds: string[]
  /** Saved outfit id, when the wear came from a saved look. */
  outfitId: string | null
  source: 'planner' | 'saved'
}

export interface OutfitWearSummary {
  wearCount: number
  lastWornAt: string | null
}

interface MarkWornInput {
  dateKey: string
  garmentIds: string[]
  outfitId?: string | null
  source: WearLogEntry['source']
  /**
   * When the wear happened. Defaults to now; the planner passes the planned
   * day so a past look records its real last-worn date.
   */
  wornAt?: string
}

interface WearContextValue {
  log: WearLogEntry[]
  /**
   * Record a confirmed wear: increments each garment's wear count, stamps
   * its last-worn date and sets its Wear Status to `worn`. Returns false
   * when this look was already logged for that day (no double counting).
   */
  markWorn: (input: MarkWornInput) => boolean
  /** The wear entry for a planned/saved look on a given day, if any. */
  wornEntryFor: (dateKey: string, outfitId: string) => WearLogEntry | undefined
  /** How many times a saved look has been worn, and when it last was. */
  outfitWear: (outfitId: string) => OutfitWearSummary
  /** Replace the whole log after a cloud pull. */
  hydrateLog: (entries: WearLogEntry[]) => void
}

const WearContext = createContext<WearContextValue | null>(null)

function readLog(): WearLogEntry[] {
  try {
    const raw = localStorage.getItem(LOG_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as WearLogEntry[]
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(
        (entry) =>
          entry &&
          typeof entry.id === 'string' &&
          typeof entry.dateKey === 'string' &&
          typeof entry.wornAt === 'string' &&
          Array.isArray(entry.garmentIds) &&
          entry.garmentIds.every((id) => typeof id === 'string') &&
          (entry.outfitId === null || typeof entry.outfitId === 'string') &&
          (entry.source === 'planner' || entry.source === 'saved'),
      )
      .slice(0, MAX_ENTRIES)
  } catch {
    return []
  }
}

const sameCombo = (a: string[], b: string[]) =>
  a.length === b.length && a.every((id, i) => id === b[i])

/** Must be mounted inside WardrobeProvider (updates garment wear stats). */
export function WearProvider({ children }: { children: ReactNode }) {
  const { garmentById, updateGarment } = useWardrobe()
  const [log, setLog] = useState<WearLogEntry[]>(readLog)

  useEffect(() => {
    try {
      localStorage.setItem(LOG_KEY, JSON.stringify(log))
    } catch {
      /* storage unavailable */
    }
  }, [log])

  const markWorn = useCallback(
    ({ dateKey, garmentIds, outfitId = null, source, wornAt: wornAtInput }: MarkWornInput): boolean => {
      const ids = garmentIds.filter(Boolean)
      if (ids.length === 0) return false

      const alreadyLogged = log.some((entry) =>
        entry.dateKey === dateKey &&
        (outfitId ? entry.outfitId === outfitId : sameCombo(entry.garmentIds, ids)),
      )
      if (alreadyLogged) return false

      const wornAt =
        wornAtInput && !Number.isNaN(Date.parse(wornAtInput))
          ? wornAtInput
          : new Date().toISOString()
      setLog((prev) =>
        [
          {
            id: `wear_${crypto.randomUUID()}`,
            dateKey,
            wornAt,
            garmentIds: ids,
            outfitId,
            source,
          },
          ...prev,
        ].slice(0, MAX_ENTRIES),
      )

      // Confirmed wear → update each piece's stats and Wear Status. The
      // user can switch any piece back to Ready from the wardrobe.
      for (const id of ids) {
        const garment = garmentById(id)
        if (!garment) continue
        updateGarment(id, {
          wearStatus: 'worn',
          wearCount: garmentWearCount(garment) + 1,
          lastWornAt: wornAt,
        })
      }

      return true
    },
    [log, garmentById, updateGarment],
  )

  const wornEntryFor = useCallback(
    (dateKey: string, outfitId: string) =>
      log.find((entry) => entry.dateKey === dateKey && entry.outfitId === outfitId),
    [log],
  )

  const outfitWear = useCallback(
    (outfitId: string): OutfitWearSummary => {
      let wearCount = 0
      let lastWornAt: string | null = null
      for (const entry of log) {
        if (entry.outfitId !== outfitId) continue
        wearCount += 1
        if (!lastWornAt || Date.parse(entry.wornAt) > Date.parse(lastWornAt)) {
          lastWornAt = entry.wornAt
        }
      }
      return { wearCount, lastWornAt }
    },
    [log],
  )

  const value = useMemo(
    () => ({ log, markWorn, wornEntryFor, outfitWear, hydrateLog: setLog }),
    [log, markWorn, wornEntryFor, outfitWear],
  )

  return <WearContext.Provider value={value}>{children}</WearContext.Provider>
}

export function useWear(): WearContextValue {
  const ctx = useContext(WearContext)
  if (!ctx) throw new Error('useWear must be used within WearProvider')
  return ctx
}
