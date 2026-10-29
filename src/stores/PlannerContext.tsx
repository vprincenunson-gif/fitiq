import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Vibe } from '../services/recommend'

/* ────────────────────────────────────────────────────────────────────────
   Outfit Planner — a lightweight, local weekly plan.

   The plan maps a local calendar date (YYYY-MM-DD) to an already-saved
   outfit id (from 'fitiq.outfits.saved') and an occasion vibe. No images
   are stored here — pieces are resolved from the wardrobe at render time,
   so deleted garments disappear gracefully and the plan stays tiny.
   ──────────────────────────────────────────────────────────────────────── */

export interface PlannedDay {
  /** Id of a saved outfit, or null when the day has no look yet. */
  outfitId: string | null
  /** Optional occasion for the day ('casual', 'formal', …). */
  occasion: Vibe | null
}

export type PlannerPlan = Record<string, PlannedDay>

const STORAGE_KEY = 'fitiq.planner.v1'

interface PlannerContextValue {
  plan: PlannerPlan
  assignOutfit: (dateKey: string, outfitId: string | null) => void
  setOccasion: (dateKey: string, occasion: Vibe | null) => void
  clearDay: (dateKey: string) => void
}

function readPlan(): PlannerPlan {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as PlannerPlan
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {}
    const clean: PlannerPlan = {}
    for (const [key, value] of Object.entries(parsed)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) continue
      if (typeof value !== 'object' || value === null) continue
      const day = value as PlannedDay
      clean[key] = {
        outfitId: typeof day.outfitId === 'string' ? day.outfitId : null,
        occasion: typeof day.occasion === 'string' ? (day.occasion as Vibe) : null,
      }
    }
    return clean
  } catch {
    return {}
  }
}

/** Local (not UTC) calendar key, stable across midnight. */
export function localDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = `${date.getMonth() + 1}`.padStart(2, '0')
  const d = `${date.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** The Monday-start 7-day week containing today, offset by whole weeks. */
export function weekDates(weekOffset = 0): Date[] {
  const now = new Date()
  const mondayOffset = (now.getDay() + 6) % 7 // 0 → Monday
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - mondayOffset + weekOffset * 7)
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(monday)
    date.setDate(monday.getDate() + i)
    return date
  })
}

export function isSameLocalDay(a: Date, b: Date): boolean {
  return localDateKey(a) === localDateKey(b)
}

/** "Oct 26 – Nov 1, 2026" — an editorial range label for a week. */
export function formatWeekRange(dates: Date[]): string {
  const fmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })
  const start = fmt.format(dates[0])
  const endYear = dates[6].getFullYear() !== dates[0].getFullYear()
    ? ` ${dates[6].getFullYear()}`
    : ''
  return `${start} – ${fmt.format(dates[6])},${endYear}`
}

export function PlannerProvider({ children }: { children: ReactNode }) {
  const [plan, setPlan] = useState<PlannerPlan>(readPlan)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(plan))
    } catch {
      /* storage unavailable */
    }
  }, [plan])

  const assignOutfit = useCallback((dateKey: string, outfitId: string | null) => {
    setPlan((prev) => {
      const current = prev[dateKey]
      if (!outfitId && !(current?.outfitId ?? false)) return prev
      return { ...prev, [dateKey]: { outfitId, occasion: current?.occasion ?? null } }
    })
  }, [])

  const setOccasion = useCallback((dateKey: string, occasion: Vibe | null) => {
    setPlan((prev) => {
      const current = prev[dateKey]
      if (!occasion && !(current?.occasion ?? false)) return prev
      return { ...prev, [dateKey]: { outfitId: current?.outfitId ?? null, occasion } }
    })
  }, [])

  const clearDay = useCallback((dateKey: string) => {
    setPlan((prev) => {
      if (!prev[dateKey]) return prev
      const next = { ...prev }
      delete next[dateKey]
      return next
    })
  }, [])

  const value = useMemo(
    () => ({ plan, assignOutfit, setOccasion, clearDay }),
    [plan, assignOutfit, setOccasion, clearDay],
  )

  return <PlannerContext.Provider value={value}>{children}</PlannerContext.Provider>
}

const PlannerContext = createContext<PlannerContextValue | null>(null)

export function usePlanner(): PlannerContextValue {
  const ctx = useContext(PlannerContext)
  if (!ctx) throw new Error('usePlanner must be used within PlannerProvider')
  return ctx
}
