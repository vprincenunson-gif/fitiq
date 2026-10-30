import type { Garment, GarmentCategory, WearStatus } from './types'
import {
  CATEGORY_LABELS,
  WEAR_STATUS_LABELS,
  WEAR_STATUS_VALUES,
  garmentLastWornAt,
  garmentWearCount,
  garmentWearStatus,
} from './types'
import { daysSinceWorn } from './wear'

/* ────────────────────────────────────────────────────────────────────────
   Wardrobe Insights — pure calculations over the local wardrobe and the
   confirmed wear log. No network, no images leave the browser.
   ──────────────────────────────────────────────────────────────────────── */

/** Minimal shape of a confirmed wear entry (WearContext's WearLogEntry fits). */
export interface WearLogLike {
  dateKey: string
  garmentIds: string[]
  wornAt: string
}

export interface RankedGarment {
  garment: Garment
  wearCount: number
  lastWornAt: string | null
  /** Whole local days since the last wear; null = never worn. */
  daysSince: number | null
}

export interface MonthActivity {
  key: string
  /** "October 2026" */
  label: string
  /** "Oct" */
  shortLabel: string
  count: number
}

export interface StatusSlice {
  status: WearStatus
  label: string
  count: number
  percent: number
}

export interface CategoryUsage {
  category: GarmentCategory
  label: string
  pieces: number
  totalWears: number
  avgWears: number
  /** Share of all confirmed wears, 0–100. */
  share: number
  mostWorn: RankedGarment | null
}

export interface WardrobeInsights {
  totalPieces: number
  totalWears: number
  piecesWorn: number
  neverWorn: number
  /** 0–100. */
  utilization: number
  readyCount: number
  laundryCount: number
  wornCount: number
  looksLogged: number
  activeDays: number
  avgLooksPerActiveDay: number
  lastWornAt: string | null
  mostWorn: RankedGarment[]
  leastWorn: RankedGarment[]
  months: MonthActivity[]
  statuses: StatusSlice[]
  categories: CategoryUsage[]
  topCategory: CategoryUsage | null
  mostWornGarment: RankedGarment | null
  restedLongest: RankedGarment | null
}

const MONTH_SHORT = new Intl.DateTimeFormat('en-US', { month: 'short' })
const MONTH_LONG = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' })
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/

const timeOf = (value: string | null): number =>
  value && !Number.isNaN(Date.parse(value)) ? Date.parse(value) : 0

const byMostWorn = (a: RankedGarment, b: RankedGarment): number =>
  b.wearCount - a.wearCount ||
  timeOf(b.lastWornAt) - timeOf(a.lastWornAt) ||
  a.garment.name.localeCompare(b.garment.name)

const byLeastWorn = (a: RankedGarment, b: RankedGarment): number =>
  a.wearCount - b.wearCount ||
  // Never-worn pieces come first, then the oldest timestamp.
  (a.lastWornAt ? 1 : 0) - (b.lastWornAt ? 1 : 0) ||
  timeOf(a.lastWornAt) - timeOf(b.lastWornAt) ||
  a.garment.name.localeCompare(b.garment.name)

/**
 * Integer percentages that always add up to 100 (largest-remainder method),
 * so a status legend never reads 101%.
 */
function integerPercentages(values: number[], total: number): number[] {
  if (total <= 0) return values.map(() => 0)
  const raw = values.map((value) => (value / total) * 100)
  const result = raw.map(Math.floor)
  const remaining = 100 - result.reduce((sum, value) => sum + value, 0)
  const order = raw
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction)
  for (let i = 0; i < remaining; i += 1) {
    result[order[i % order.length].index] += 1
  }
  return result
}

function localMonthKey(date: Date): string {
  const y = date.getFullYear()
  const m = `${date.getMonth() + 1}`.padStart(2, '0')
  return `${y}-${m}`
}

/** The last `count` local calendar months, oldest first. */
export function recentMonths(count = 6, now: Date = new Date()): Omit<MonthActivity, 'count'>[] {
  const months: Omit<MonthActivity, 'count'>[] = []
  for (let i = count - 1; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push({
      key: localMonthKey(date),
      label: MONTH_LONG.format(date),
      shortLabel: MONTH_SHORT.format(date),
    })
  }
  return months
}

/** "Today" / "Yesterday" / "12 days ago" — compact recency copy. */
export function wearAgeLabel(days: number | null): string {
  if (days === null) return 'Never worn'
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return `${days} days ago`
}

export function buildWardrobeInsights(
  garments: Garment[],
  log: WearLogLike[],
  now: Date = new Date(),
): WardrobeInsights {
  const ranked: RankedGarment[] = garments.map((garment) => {
    const lastWornAt = garmentLastWornAt(garment)
    return {
      garment,
      wearCount: garmentWearCount(garment),
      lastWornAt,
      daysSince: daysSinceWorn(lastWornAt, now),
    }
  })

  const totalPieces = ranked.length
  const totalWears = ranked.reduce((sum, item) => sum + item.wearCount, 0)
  const piecesWorn = ranked.filter((item) => item.wearCount > 0).length
  const neverWorn = totalPieces - piecesWorn
  const utilization = totalPieces > 0 ? Math.round((piecesWorn / totalPieces) * 100) : 0

  const statusCounts = WEAR_STATUS_VALUES.map((status) => ({
    status,
    count: garments.filter((garment) => garmentWearStatus(garment) === status).length,
  }))
  const countFor = (status: WearStatus) =>
    statusCounts.find((slice) => slice.status === status)?.count ?? 0

  const statusPercents = integerPercentages(
    statusCounts.map((slice) => slice.count),
    totalPieces,
  )
  const statuses: StatusSlice[] = statusCounts.map((slice, index) => ({
    ...slice,
    label: WEAR_STATUS_LABELS[slice.status],
    percent: statusPercents[index] ?? 0,
  }))

  const validEntries = log.filter((entry) => DATE_KEY.test(entry.dateKey))
  const activeDays = new Set(validEntries.map((entry) => entry.dateKey)).size
  const looksLogged = validEntries.length
  const avgLooksPerActiveDay = activeDays > 0 ? looksLogged / activeDays : 0

  const latestGarmentWear = ranked.reduce<string | null>((latest, item) => {
    if (!item.lastWornAt) return latest
    return !latest || timeOf(item.lastWornAt) > timeOf(latest) ? item.lastWornAt : latest
  }, null)
  const latestLogWear = validEntries.reduce<string | null>((latest, entry) => {
    if (!entry.wornAt || Number.isNaN(Date.parse(entry.wornAt))) return latest
    return !latest || timeOf(entry.wornAt) > timeOf(latest) ? entry.wornAt : latest
  }, null)
  const lastWornAt =
    timeOf(latestGarmentWear) >= timeOf(latestLogWear) ? latestGarmentWear : latestLogWear

  // Balanced, non-overlapping most/least lists: the top half (up to four)
  // leads, the resting half fills the other card.
  const sortedMost = [...ranked].sort(byMostWorn)
  const sortedLeast = [...ranked].sort(byLeastWorn)
  const mostCount = Math.min(4, Math.max(1, Math.ceil(ranked.length / 2)))
  const mostWorn = sortedMost.slice(0, mostCount)
  const mostIds = new Set(mostWorn.map((item) => item.garment.id))
  const leastWorn = sortedLeast
    .filter((item) => !mostIds.has(item.garment.id))
    .slice(0, Math.min(4, ranked.length - mostCount))

  const monthDefinitions = recentMonths(6, now)
  const monthCounts = new Map(monthDefinitions.map((month) => [month.key, 0]))
  for (const entry of validEntries) {
    const key = entry.dateKey.slice(0, 7)
    if (monthCounts.has(key)) monthCounts.set(key, (monthCounts.get(key) ?? 0) + 1)
  }
  const months: MonthActivity[] = monthDefinitions.map((month) => ({
    ...month,
    count: monthCounts.get(month.key) ?? 0,
  }))

  const categoryData = (['shirt', 'pants', 'shoes'] as GarmentCategory[]).map((category) => {
    const pieces = ranked.filter((item) => item.garment.category === category)
    const categoryWears = pieces.reduce((sum, item) => sum + item.wearCount, 0)
    const mostWornPiece = [...pieces].sort(byMostWorn)[0] ?? null
    return {
      category,
      label: CATEGORY_LABELS[category],
      pieces: pieces.length,
      totalWears: categoryWears,
      avgWears: pieces.length > 0 ? categoryWears / pieces.length : 0,
      mostWorn: mostWornPiece,
    }
  })
  const categoryShares = integerPercentages(
    categoryData.map((category) => category.totalWears),
    totalWears,
  )
  const categories: CategoryUsage[] = categoryData.map((category, index) => ({
    ...category,
    share: categoryShares[index] ?? 0,
  }))

  const topCategory =
    totalWears > 0
      ? [...categories]
          .filter((category) => category.pieces > 0)
          .sort((a, b) => b.totalWears - a.totalWears || b.pieces - a.pieces)[0] ?? null
      : null

  const mostWornGarment = totalWears > 0 ? sortedMost[0] ?? null : null
  const restedLongest =
    [...ranked]
      .filter((item) => item.lastWornAt != null)
      .sort((a, b) => (b.daysSince ?? 0) - (a.daysSince ?? 0))[0] ?? null

  return {
    totalPieces,
    totalWears,
    piecesWorn,
    neverWorn,
    utilization,
    readyCount: countFor('ready'),
    laundryCount: countFor('in-laundry'),
    wornCount: countFor('worn'),
    looksLogged,
    activeDays,
    avgLooksPerActiveDay,
    lastWornAt,
    mostWorn,
    leastWorn,
    months,
    statuses,
    categories,
    topCategory,
    mostWornGarment,
    restedLongest,
  }
}
