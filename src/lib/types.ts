/* ─────────────────────────────────────────────────────
   FITIQ domain types
   ───────────────────────────────────────────────────── */

/*
 * Gender-inclusive category set. The original ids (`shirt`, `pants`, `shoes`)
 * are kept exactly as-is so existing local data, saved looks, cloud rows and
 * outfit slots keep working without a rewrite.
 */
export type GarmentCategory =
  | 'shirt'
  | 'blouse'
  | 'top'
  | 'pants'
  | 'jeans'
  | 'skirt'
  | 'dress'
  | 'jumpsuit'
  | 'ethnic'
  | 'shoes'
  | 'accessory'

/** Canonical display/filter order. */
export const GARMENT_CATEGORIES: GarmentCategory[] = [
  'shirt',
  'blouse',
  'top',
  'pants',
  'jeans',
  'skirt',
  'dress',
  'jumpsuit',
  'ethnic',
  'shoes',
  'accessory',
]

export function isGarmentCategory(value: unknown): value is GarmentCategory {
  return typeof value === 'string' && (GARMENT_CATEGORIES as string[]).includes(value)
}

/** The three slots the current outfit composer and recommendations support. */
export type OutfitSlot = 'top' | 'bottom' | 'shoes'

/**
 * Which composition slot a category can fill. Categories absent from this map
 * (dresses, jumpsuits, ethnic wear, accessories) are wardrobe-only until
 * compatible styling logic exists — they are never forced into a slot.
 */
export const CATEGORY_SLOT: Partial<Record<GarmentCategory, OutfitSlot>> = {
  shirt: 'top',
  blouse: 'top',
  top: 'top',
  pants: 'bottom',
  jeans: 'bottom',
  skirt: 'bottom',
  shoes: 'shoes',
}

export function slotForCategory(category: GarmentCategory): OutfitSlot | null {
  return CATEGORY_SLOT[category] ?? null
}

/**
 * Legacy keys for the in-progress outfit (localStorage + guest snapshot).
 * New top/bottom categories share the existing `shirt`/`pants` keys so an
 * existing saved look or in-flight sync payload is read without migration.
 */
export type OutfitSlotKey = 'shirt' | 'pants' | 'shoes'

export const OUTFIT_SLOT_KEYS: OutfitSlotKey[] = ['shirt', 'pants', 'shoes']

export const SLOT_KEY_BY_SLOT: Record<OutfitSlot, OutfitSlotKey> = {
  top: 'shirt',
  bottom: 'pants',
  shoes: 'shoes',
}

export function slotKeyForCategory(category: GarmentCategory): OutfitSlotKey | null {
  const slot = slotForCategory(category)
  return slot ? SLOT_KEY_BY_SLOT[slot] : null
}

export type GarmentColor =
  | 'white'
  | 'black'
  | 'oat'
  | 'beige'
  | 'charcoal'
  | 'navy'
  | 'blue'
  | 'olive'
  | 'clay'
  | 'sand'
  | 'tan'
  | 'denim'

export type GarmentFit = 'slim' | 'regular' | 'relaxed'

export type GarmentSource = 'scanned' | 'sample'

/** Real-world wear state of a garment. Defaults to `ready`. */
export type WearStatus = 'ready' | 'needs-ironing' | 'worn' | 'in-laundry'

/** Default wear state for scanned/new items. */
export const DEFAULT_WEAR_STATUS: WearStatus = 'ready'

/** All wear states in display order. */
export const WEAR_STATUS_VALUES: WearStatus[] = ['ready', 'needs-ironing', 'worn', 'in-laundry']

/** Short chip labels — sized for the compact card selector. */
export const WEAR_STATUS_SHORT_LABELS: Record<WearStatus, string> = {
  ready: 'Ready',
  'needs-ironing': 'Iron',
  worn: 'Worn',
  'in-laundry': 'Laundry',
}

/** Full user-facing labels. */
export const WEAR_STATUS_LABELS: Record<WearStatus, string> = {
  ready: 'Ready to wear',
  'needs-ironing': 'Needs ironing',
  worn: 'Worn/Used',
  'in-laundry': 'In laundry',
}

/** Only `ready` garments are available for outfit recommendations. */
export function isWearable(garment: Pick<Garment, 'wearStatus'>): boolean {
  return (garment.wearStatus ?? DEFAULT_WEAR_STATUS) === 'ready'
}

/** Safe read: treats unknown/legacy values as the default status. */
export function garmentWearStatus(garment: Pick<Garment, 'wearStatus'>): WearStatus {
  return garment.wearStatus && WEAR_STATUS_VALUES.includes(garment.wearStatus)
    ? garment.wearStatus
    : DEFAULT_WEAR_STATUS
}

/** Confirmed wear count for a garment; legacy items read as 0. */
export function garmentWearCount(garment: Pick<Garment, 'wearCount'>): number {
  const count = garment.wearCount
  return typeof count === 'number' && Number.isFinite(count) && count > 0 ? Math.floor(count) : 0
}

/** Safe read for the last confirmed wear timestamp; null when never worn. */
export function garmentLastWornAt(garment: Pick<Garment, 'lastWornAt'>): string | null {
  const value = garment.lastWornAt
  return typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : null
}

/** Wear statistics shown in the wardrobe and used for recency nudges. */
export interface GarmentWearStats {
  wearCount: number
  lastWornAt: string | null
}

export interface Garment {
  id: string
  name: string
  category: GarmentCategory
  color: GarmentColor
  colorLabel: string
  styleTags: string[]
  fit: GarmentFit
  /** Real-world wear state; defaults to `ready` via garmentWearStatus(). */
  wearStatus?: WearStatus
  /** Confirmed wear count; absent means never marked worn. */
  wearCount?: number
  /** ISO timestamp of the last confirmed wear; absent/null = never worn. */
  lastWornAt?: string | null
  /** Garment image: SVG art path (e.g. "/garments/shirt-crisp-white.svg"), a captured camera photo data URL, or a short-lived signed URL when synced. */
  image: string
  source: GarmentSource
  /** ISO date; null for seed samples */
  scannedAt: string | null
  favorite: boolean
  note?: string
  /** ISO timestamp of the last local edit; used to resolve cloud conflicts. */
  updatedAt?: string
  /**
   * Private Supabase Storage path for a user-uploaded original capture.
   * Absent for sample artwork. Never contains a public URL.
   */
  photoPath?: string
}

/** Composition shape used by the outfit builder: at most one per category. */
export interface OutfitComposition {
  top: Garment | null
  bottom: Garment | null
  shoes: Garment | null
}

export interface Outfit {
  id: string
  name: string
  /** Ordered: [top, bottom, shoes] */
  garmentIds: string[]
  createdAt: string
  /** ISO timestamp of the last edit; used to resolve cloud conflicts. */
  updatedAt?: string
}

export interface DetectedGarment {
  category: GarmentCategory
  color: GarmentColor
  colorLabel: string
  name: string
  styleTags: string[]
  fit: GarmentFit
  /** Sample SVG chosen to represent the detected item */
  image: string
  /** Vision-model confidence in the result (0–1), when AI was used. */
  confidence?: number
  /** Where the metadata came from. */
  source?: 'vision' | 'local'
  /** True when AI was requested but local analysis was used instead. */
  fallback?: boolean
}

export interface Suggestion {
  headline: string
  copy: string
  garmentIds: string[]
}

/** Style tastes the user can like or avoid (text preferences only). */
export type StyleTaste = 'minimal' | 'casual' | 'formal' | 'street' | 'sporty'

/** Persistent, lightweight styling preferences — never images. */
export interface StyleProfile {
  fit: GarmentFit | null
  favoriteColors: GarmentColor[]
  likes: StyleTaste[]
  avoids: StyleTaste[]
  /** ISO timestamp of the last edit; used to resolve cloud conflicts. */
  updatedAt?: string
}

export const EMPTY_STYLE_PROFILE: StyleProfile = {
  fit: null,
  favoriteColors: [],
  likes: [],
  avoids: [],
}

export const STYLE_TASTES: StyleTaste[] = ['minimal', 'casual', 'formal', 'street', 'sporty']

export const CATEGORY_LABELS: Record<GarmentCategory, string> = {
  shirt: 'Shirts',
  blouse: 'Blouses',
  top: 'Tops',
  pants: 'Pants',
  jeans: 'Jeans',
  skirt: 'Skirts',
  dress: 'Dresses',
  jumpsuit: 'Jumpsuits',
  ethnic: 'Ethnic Wear',
  shoes: 'Footwear',
  accessory: 'Accessories',
}

export const CATEGORY_SINGULAR: Record<GarmentCategory, string> = {
  shirt: 'Shirt',
  blouse: 'Blouse',
  top: 'Top',
  pants: 'Pants',
  jeans: 'Jeans',
  skirt: 'Skirt',
  dress: 'Dress',
  jumpsuit: 'Jumpsuit',
  ethnic: 'Ethnic Wear',
  shoes: 'Shoes',
  accessory: 'Accessory',
}

export function categoryNextInSequence(state: OutfitComposition): GarmentCategory | null {
  if (!state.top) return 'shirt'
  if (!state.bottom) return 'pants'
  if (!state.shoes) return 'shoes'
  return null
}

/**
 * Generic, user-facing name built from the metadata we actually know:
 * the analysed colour and the category the user picked. No demo/branded
 * garment names are attached to real captures.
 */
export function genericGarmentName(
  colorLabel: string,
  category: GarmentCategory,
): string {
  const singular = CATEGORY_SINGULAR[category]
  const label = colorLabel.trim()
  return label ? `${label} ${singular}` : singular
}
