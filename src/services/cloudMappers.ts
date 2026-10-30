import type {
  Garment,
  GarmentCategory,
  GarmentColor,
  GarmentFit,
  GarmentSource,
  Outfit,
  StyleProfile,
  StyleTaste,
  WearStatus,
} from '../lib/types'
import {
  DEFAULT_WEAR_STATUS,
  STYLE_TASTES,
  WEAR_STATUS_VALUES,
  garmentLastWornAt,
  garmentWearCount,
  garmentWearStatus,
  isGarmentCategory,
} from '../lib/types'
import type { WearLogEntry } from '../stores/WearContext'
import type { PlannerPlan, PlannedDay } from '../stores/PlannerContext'

/* ────────────────────────────────────────────────────────────────────────
   Database <-> app mapping.

   Rows hold metadata plus a private Storage path — never a public photo URL.
   Signed URLs are short-lived and are only attached at read time, so the
   database never becomes a public image host.
   ──────────────────────────────────────────────────────────────────────── */

export const CLOUD_TABLES = {
  wardrobe: 'wardrobe_items',
  wearLog: 'wear_log',
  outfits: 'saved_outfits',
  planner: 'planner_days',
  style: 'style_profiles',
} as const

export const PHOTO_BUCKET = 'wardrobe-photos'

export const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7

export interface WardrobeRow {
  id: string
  user_id: string
  name: string
  category: string
  color: string
  color_label: string
  style_tags: string[]
  fit: string
  wear_status: string
  wear_count: number
  last_worn_at: string | null
  /** Bundled SVG path for sample artwork; null for uploaded photos. */
  image_path: string | null
  /** Private Storage object path; null for sample artwork. */
  photo_path: string | null
  source: string
  scanned_at: string | null
  favorite: boolean
  note: string | null
  updated_at: string
}

export interface WearRow {
  id: string
  user_id: string
  date_key: string
  worn_at: string
  garment_ids: string[]
  outfit_id: string | null
  source: string
  created_at: string
}

export interface OutfitRow {
  id: string
  user_id: string
  name: string
  garment_ids: string[]
  created_at: string
  updated_at: string
}

export interface PlannerRow {
  user_id: string
  date_key: string
  outfit_id: string | null
  occasion: string | null
  updated_at: string
}

export interface StyleRow {
  user_id: string
  fit: string | null
  favorite_colors: string[]
  likes: string[]
  avoids: string[]
  updated_at: string
}

const FITS = new Set<GarmentFit>(['slim', 'regular', 'relaxed'])
const COLORS = new Set<GarmentColor>([
  'white', 'black', 'oat', 'beige', 'charcoal', 'navy', 'blue',
  'olive', 'clay', 'sand', 'tan', 'denim',
])
const STATUSES = new Set<WearStatus>(WEAR_STATUS_VALUES)
const TASTES = new Set<StyleTaste>(STYLE_TASTES)

const asCategory = (value: string): GarmentCategory =>
  isGarmentCategory(value) ? value : 'shirt'
const asFit = (value: string): GarmentFit =>
  FITS.has(value as GarmentFit) ? (value as GarmentFit) : 'regular'
const asColor = (value: string): GarmentColor =>
  COLORS.has(value as GarmentColor) ? (value as GarmentColor) : 'oat'
const asStatus = (value: string): WearStatus =>
  STATUSES.has(value as WearStatus) ? (value as WearStatus) : DEFAULT_WEAR_STATUS
const asSource = (value: string): GarmentSource =>
  value === 'sample' ? 'sample' : 'scanned'
const asTaste = (value: string): StyleTaste | null =>
  TASTES.has(value as StyleTaste) ? (value as StyleTaste) : null

const isIso = (value: string | null | undefined): string | null =>
  value && !Number.isNaN(Date.parse(value)) ? value : null

/** Small, dependency-free placeholder used if a signed URL cannot be resolved. */
const GLYPHS: Record<GarmentCategory, string> = {
  shirt: '<path d="M18 12l6 6 6-6 4 4-6 6v14h-8V22l-6-6z" fill="none" stroke="#97907f" stroke-width="1.5"/>',
  blouse: '<path d="M18 12l6 6 6-6 4 4-6 6v14h-8V22l-6-6z" fill="none" stroke="#97907f" stroke-width="1.5"/>',
  top: '<path d="M18 12l6 6 6-6 4 4-6 6v14h-8V22l-6-6z" fill="none" stroke="#97907f" stroke-width="1.5"/>',
  pants: '<path d="M18 12h12l2 28-6 2-2-16-2 16-6-2z" fill="none" stroke="#97907f" stroke-width="1.5"/>',
  jeans: '<path d="M18 12h12l2 28-6 2-2-16-2 16-6-2z" fill="none" stroke="#97907f" stroke-width="1.5"/>',
  skirt: '<path d="M19 12h10l1 8 6 20H12l6-20z" fill="none" stroke="#97907f" stroke-width="1.5"/>',
  dress: '<path d="M19 10h10l-4 8 10 20H13l10-20z" fill="none" stroke="#97907f" stroke-width="1.5"/>',
  jumpsuit: '<path d="M18 10h12l2 12-4 18h-8l-4-18z" fill="none" stroke="#97907f" stroke-width="1.5"/>',
  ethnic: '<path d="M18 11h12l4 9-4 20h-12l-4-20z" fill="none" stroke="#97907f" stroke-width="1.5"/>',
  shoes: '<path d="M12 30h24l-2-8-8-2-4 4h-6z" fill="none" stroke="#97907f" stroke-width="1.5"/>',
  accessory: '<circle cx="24" cy="22" r="7" fill="none" stroke="#97907f" stroke-width="1.5"/><path d="M18 29l-3 9h18l-3-9" fill="none" stroke="#97907f" stroke-width="1.5"/>',
}

/** Small, dependency-free placeholder used if a signed URL cannot be resolved. */
export function fallbackGarmentImage(category: GarmentCategory): string {
  const glyph = GLYPHS[category] ?? GLYPHS.shirt
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="#f0ebe1"/>${glyph}</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export function garmentToRow(
  garment: Garment,
  userId: string,
  photoPath: string | null,
  now: string,
): WardrobeRow {
  const resolvedPhoto = photoPath ?? garment.photoPath ?? null
  const image = garment.image.trim()
  const imagePath =
    resolvedPhoto || !image || image.startsWith('data:') || image.startsWith('http')
      ? null
      : image

  return {
    id: garment.id,
    user_id: userId,
    name: garment.name,
    category: asCategory(garment.category),
    color: asColor(garment.color),
    color_label: garment.colorLabel,
    style_tags: Array.isArray(garment.styleTags) ? garment.styleTags : [],
    fit: asFit(garment.fit),
    wear_status: garmentWearStatus(garment),
    wear_count: garmentWearCount(garment),
    last_worn_at: garmentLastWornAt(garment),
    image_path: imagePath,
    photo_path: resolvedPhoto,
    source: asSource(garment.source),
    scanned_at: isIso(garment.scannedAt),
    favorite: Boolean(garment.favorite),
    note: garment.note ?? null,
    updated_at: isIso(garment.updatedAt) ?? now,
  }
}

export function rowToGarment(row: WardrobeRow, signedUrl: string | null): Garment {
  const category = asCategory(row.category)
  return {
    id: row.id,
    name: row.name || 'Untitled piece',
    category,
    color: asColor(row.color),
    colorLabel: row.color_label || 'Neutral',
    styleTags: Array.isArray(row.style_tags) ? row.style_tags : [],
    fit: asFit(row.fit),
    wearStatus: asStatus(row.wear_status),
    wearCount: Math.max(0, Math.floor(Number(row.wear_count) || 0)),
    lastWornAt: isIso(row.last_worn_at),
    image: row.photo_path
      ? signedUrl ?? fallbackGarmentImage(category)
      : row.image_path ?? fallbackGarmentImage(category),
    source: asSource(row.source),
    scannedAt: isIso(row.scanned_at),
    favorite: Boolean(row.favorite),
    note: row.note ?? undefined,
    updatedAt: row.updated_at,
    photoPath: row.photo_path ?? undefined,
  }
}

export function wearToRow(entry: WearLogEntry, userId: string, now: string): WearRow {
  return {
    id: entry.id,
    user_id: userId,
    date_key: entry.dateKey,
    worn_at: isIso(entry.wornAt) ?? now,
    garment_ids: entry.garmentIds,
    outfit_id: entry.outfitId,
    source: entry.source,
    created_at: isIso(entry.wornAt) ?? now,
  }
}

export function rowToWear(row: WearRow): WearLogEntry {
  return {
    id: row.id,
    dateKey: row.date_key,
    wornAt: row.worn_at,
    garmentIds: Array.isArray(row.garment_ids) ? row.garment_ids : [],
    outfitId: row.outfit_id ?? null,
    source: row.source === 'saved' ? 'saved' : 'planner',
  }
}

export function outfitToRow(outfit: Outfit, userId: string, now: string): OutfitRow {
  return {
    id: outfit.id,
    user_id: userId,
    name: outfit.name,
    garment_ids: outfit.garmentIds,
    created_at: isIso(outfit.createdAt) ?? now,
    updated_at: isIso(outfit.updatedAt) ?? isIso(outfit.createdAt) ?? now,
  }
}

export function rowToOutfit(row: OutfitRow): Outfit {
  return {
    id: row.id,
    name: row.name,
    garmentIds: Array.isArray(row.garment_ids) ? row.garment_ids : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function planToRows(
  plan: PlannerPlan,
  userId: string,
  now: string,
): PlannerRow[] {
  return Object.entries(plan).map(([dateKey, day]) => ({
    user_id: userId,
    date_key: dateKey,
    outfit_id: day.outfitId,
    occasion: day.occasion,
    updated_at: isIso(day.updatedAt) ?? now,
  }))
}

export function rowsToPlan(rows: PlannerRow[]): PlannerPlan {
  const plan: PlannerPlan = {}
  for (const row of rows) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date_key)) continue
    const day: PlannedDay = {
      outfitId: typeof row.outfit_id === 'string' ? row.outfit_id : null,
      occasion: typeof row.occasion === 'string' ? (row.occasion as PlannedDay['occasion']) : null,
      updatedAt: row.updated_at,
    }
    plan[row.date_key] = day
  }
  return plan
}

export function styleToRow(
  profile: StyleProfile,
  userId: string,
  now: string,
): StyleRow {
  return {
    user_id: userId,
    fit: profile.fit,
    favorite_colors: profile.favoriteColors,
    likes: profile.likes,
    avoids: profile.avoids,
    updated_at: isIso(profile.updatedAt) ?? now,
  }
}

export function rowToStyle(row: StyleRow): StyleProfile {
  return {
    fit: row.fit && FITS.has(row.fit as GarmentFit) ? (row.fit as GarmentFit) : null,
    favoriteColors: (row.favorite_colors ?? [])
      .map(asColor)
      .filter((value, index, all) => all.indexOf(value) === index),
    likes: (row.likes ?? []).map(asTaste).filter((value): value is StyleTaste => value != null),
    avoids: (row.avoids ?? []).map(asTaste).filter((value): value is StyleTaste => value != null),
    updatedAt: row.updated_at,
  }
}
