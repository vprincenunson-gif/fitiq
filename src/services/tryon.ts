import type { GarmentCategory, OutfitComposition } from '../lib/types'

/** One rendered layer of the composed outfit. */
export interface OutfitLayer {
  category: GarmentCategory
  image: string
  garmentId: string
  label: string
}

export interface ComposedOutfit {
  layers: OutfitLayer[]
}

/**
 * Outfit composition boundary — resolves the current composition into its
 * layers for the showcase. The mock returns the pieces directly; a real
 * provider could return the same shape from an external styling engine.
 */
export interface TryOnService {
  compose(outfit: OutfitComposition): Promise<ComposedOutfit>
}

export class MockTryOnService implements TryOnService {
  async compose(outfit: OutfitComposition): Promise<ComposedOutfit> {
    const layers: OutfitLayer[] = []
    if (outfit.top) {
      layers.push({
        category: 'shirt',
        image: outfit.top.image,
        garmentId: outfit.top.id,
        label: outfit.top.name,
      })
    }
    if (outfit.bottom) {
      layers.push({
        category: 'pants',
        image: outfit.bottom.image,
        garmentId: outfit.bottom.id,
        label: outfit.bottom.name,
      })
    }
    if (outfit.shoes) {
      layers.push({
        category: 'shoes',
        image: outfit.shoes.image,
        garmentId: outfit.shoes.id,
        label: outfit.shoes.name,
      })
    }
    return { layers }
  }
}
