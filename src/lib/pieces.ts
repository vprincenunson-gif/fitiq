import type { Garment, OutfitSlot } from './types'
import { CATEGORY_SINGULAR } from './types'

/** A resolved outfit piece, ready to render as a thumbnail. */
export interface Piece {
  image: string
  name: string
  categoryLabel: string
}

const SLOT_ORDER: OutfitSlot[] = ['top', 'bottom', 'shoes']

const SLOT_LABELS: Record<OutfitSlot, string> = {
  top: 'Top',
  bottom: 'Bottom',
  shoes: 'Shoes',
}

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
    const slot = SLOT_ORDER[index]
    return [
      {
        image: garment.image,
        name: garment.name,
        categoryLabel: slot ? SLOT_LABELS[slot] : CATEGORY_SINGULAR[garment.category],
      },
    ]
  })
}
