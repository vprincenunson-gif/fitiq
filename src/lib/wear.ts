import type { GarmentWearStats } from './types'
import { garmentLastWornAt, garmentWearCount } from './types.ts'

/* ────────────────────────────────────────────────────────────────────────
   Wear tracking helpers — small, pure utilities shared by the wardrobe,
   planner and recommendation layers. Wear stats themselves live on each
   garment (`wearCount`, `lastWornAt`) in the wardrobe's localStorage key.
   ──────────────────────────────────────────────────────────────────────── */

const SHORT_DATE = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })

/** Local (not UTC) calendar key, e.g. "2026-10-29". */
export function wearDayKey(date: Date): string {
  const y = date.getFullYear()
  const m = `${date.getMonth() + 1}`.padStart(2, '0')
  const d = `${date.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Whole local days since a wear timestamp. `null` means never worn (or an
 * unreadable timestamp), which callers treat as "due for a turn".
 */
export function daysSinceWorn(
  lastWornAt: string | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!lastWornAt) return null
  const then = new Date(lastWornAt)
  if (Number.isNaN(then.getTime())) return null
  const a = Date.UTC(then.getFullYear(), then.getMonth(), then.getDate())
  const b = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.max(0, Math.round((b - a) / 86_400_000))
}

/**
 * ISO timestamp for a wear that happened on `day`, keeping the current local
 * time of day. Marking a past planned day should record that day as the
 * last-worn date, not the moment the user confirmed it.
 */
export function wearTimestampForDay(day: Date, now: Date = new Date()): string {
  const stamp = new Date(day)
  stamp.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds())
  return stamp.toISOString()
}

/** "Oct 28" — a compact last-worn label, or null when never worn. */
export function formatWornDate(lastWornAt: string | null | undefined): string | null {
  if (!lastWornAt) return null
  const date = new Date(lastWornAt)
  if (Number.isNaN(date.getTime())) return null
  return SHORT_DATE.format(date)
}

/** "Worn 3× · Oct 28" / "Never worn". */
export function wearStatLabel(stats: GarmentWearStats): string {
  const count = stats.wearCount > 0 ? Math.floor(stats.wearCount) : 0
  const date = formatWornDate(stats.lastWornAt)
  if (count === 0 || !date) return count === 0 ? 'Never worn' : `${count}× worn`
  return `Worn ${count}× · ${date}`
}

/** Normalized stats straight from a garment record. */
export function garmentWearStats(garment: {
  wearCount?: number
  lastWornAt?: string | null
}): GarmentWearStats {
  return {
    wearCount: garmentWearCount(garment),
    lastWornAt: garmentLastWornAt(garment),
  }
}
