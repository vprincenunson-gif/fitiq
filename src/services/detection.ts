import type { DetectedGarment } from '../lib/types'
import shirtCrispWhite from '../assets/garments/shirt-crisp-white.svg'
import pantCharcoal from '../assets/garments/pant-charcoal-tailored.svg'
import shoeBlack from '../assets/garments/shoe-black-leather.svg'

/**
 * Future AI vision boundary: classify a captured camera frame and return the
 * detected garment. Swap MockDetectionService for a real implementation
 * (hosted classification/segmentation API) without touching UI code.
 */
export interface GarmentDetectionService {
  detect(frame: ImageData | string): Promise<DetectedGarment>
}

const CANDIDATES: DetectedGarment[] = [
  {
    category: 'shirt',
    color: 'white',
    colorLabel: 'Crisp White',
    name: 'Crisp White Shirt',
    styleTags: ['minimal', 'formal'],
    fit: 'regular',
    image: shirtCrispWhite,
  },
  {
    category: 'pants',
    color: 'charcoal',
    colorLabel: 'Charcoal',
    name: 'Charcoal Tailored Pants',
    styleTags: ['formal', 'minimal'],
    fit: 'slim',
    image: pantCharcoal,
  },
  {
    category: 'shoes',
    color: 'black',
    colorLabel: 'Black',
    name: 'Black Leather Shoes',
    styleTags: ['formal', 'evening'],
    fit: 'regular',
    image: shoeBlack,
  },
]

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Mock detector: waits, then returns a canned result (cycles for demo). */
export class MockDetectionService implements GarmentDetectionService {
  private cursor = 0

  async detect(_frame: ImageData | string): Promise<DetectedGarment> {
    await delay(1400)
    const result = CANDIDATES[this.cursor % CANDIDATES.length]
    this.cursor += 1
    return result
  }
}
