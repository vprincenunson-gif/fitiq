import type { Garment } from '../lib/types'

/**
 * FITIQ ships with an empty wardrobe. Items enter only through the user
 * scanning real garments with the camera — no seeded/demo pieces, no
 * generated garment artwork. This constant exists as a typed, always-empty
 * fallback for call sites that expect an initial wardrobe.
 */
export const MOCK_WARDROBE: Garment[] = []
