/* ─────────────────────────────────────────────────────
   FITIQ domain types
   ───────────────────────────────────────────────────── */

export type GarmentCategory = 'shirt' | 'pants' | 'shoes'

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

export interface Garment {
  id: string
  name: string
  category: GarmentCategory
  color: GarmentColor
  colorLabel: string
  styleTags: string[]
  fit: GarmentFit
  /** Garment image: SVG art path (e.g. "/garments/shirt-crisp-white.svg") or a captured camera photo data URL */
  image: string
  source: GarmentSource
  /** ISO date; null for seed samples */
  scannedAt: string | null
  favorite: boolean
  note?: string
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
  pants: 'Pants',
  shoes: 'Shoes',
}

export const CATEGORY_SINGULAR: Record<GarmentCategory, string> = {
  shirt: 'Shirt',
  pants: 'Pants',
  shoes: 'Shoes',
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
