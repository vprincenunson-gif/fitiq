import type { Garment, GarmentCategory } from './types'

/** A resolved outfit piece, ready to render as a thumbnail. */
export interface Piece {
  image: string
  name: string
  categoryLabel: string
}

const PIECE_LABELS: Record<GarmentCategory, string> = {
  shirt: 'Top',
  pants: 'Bottom',
  shoes: 'Shoes',
}

const SLOT_ORDER: GarmentCategory[] = ['shirt', 'pants', 'shoes']

/**
 * Resolve a saved outfit's garment ids against the wardrobe, in canonical
 * [top, bottom, shoes] order. Missing garments are skipped so a removed item
 * never breaks a plan or a saved look.
 */
export function resolveOutfitPieces(
  garmentIds: string[],
  byId: ReadonlyMap<string, Garment>,
): Piece[] {
  return garmentIds.flatMap((id, index) => {
    const garment = byId.get(id)
    if (!garment) return []
    const category = SLOT_ORDER[index] ?? garment.category
    return [{ image: garment.image, name: garment.name, categoryLabel: PIECE_LABELS[category] }]
  })
}
