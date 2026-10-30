import type { DetectedGarment, GarmentCategory, GarmentColor } from '../lib/types'
import { genericGarmentName, isGarmentCategory } from '../lib/types'
import { LocalDetectionService, type GarmentDetectionService, type DetectionOptions } from './detection'

const VISION_TIMEOUT_MS = 16_000

const COLORS = new Set<GarmentColor>([
  'white', 'black', 'oat', 'beige', 'charcoal', 'navy', 'blue',
  'olive', 'clay', 'sand', 'tan', 'denim',
])

/** Server response from POST /api/detect-garment. */
interface VisionResponse {
  category: unknown
  color: unknown
  colorLabel: unknown
  name: unknown
  confidence: unknown
}

/**
 * Client for the server-side Groq Vision route. Only called when the user has
 * explicitly consented to sending the current capture. The image is posted
 * once and is never read from or written to storage here.
 */
export class RemoteVisionDetectionService implements GarmentDetectionService {
  async detect(frame: ImageData | string): Promise<DetectedGarment> {
    if (typeof frame !== 'string' || !frame.startsWith('data:image/')) {
      throw new Error('vision-requires-image')
    }

    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), VISION_TIMEOUT_MS)
    let response: Response
    try {
      response = await fetch('/api/detect-garment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: frame }),
        signal: controller.signal,
      })
    } finally {
      window.clearTimeout(timer)
    }

    if (!response.ok) {
      throw new Error(`vision-http-${response.status}`)
    }

    const data = (await response.json()) as VisionResponse
    const { category, color, colorLabel, name, confidence } = data

    if (!isGarmentCategory(category)) {
      throw new Error('vision-invalid-category')
    }
    if (typeof color !== 'string' || !COLORS.has(color as GarmentColor)) {
      throw new Error('vision-invalid-color')
    }
    if (typeof colorLabel !== 'string' || !colorLabel.trim()) {
      throw new Error('vision-invalid-label')
    }
    if (typeof confidence !== 'number' || !Number.isFinite(confidence)) {
      throw new Error('vision-invalid-confidence')
    }

    const token = color as GarmentColor
    const label = colorLabel.trim().slice(0, 32)
    return {
      category: category as GarmentCategory,
      color: token,
      colorLabel: label,
      name: typeof name === 'string' && name.trim() ? name.trim().slice(0, 64) : genericGarmentName(label, category as GarmentCategory),
      styleTags: [],
      fit: 'regular',
      image: frame,
      confidence: Math.min(1, Math.max(0, confidence)),
      source: 'vision',
    }
  }
}

/**
 * Consent-aware facade. `mode: 'vision'` tries Groq once and transparently
 * falls back to on-device analysis on any failure. The default is local, so
 * no capture can ever be uploaded without an explicit mode selection.
 */
export class DetectionService implements GarmentDetectionService {
  private readonly vision = new RemoteVisionDetectionService()
  private readonly local = new LocalDetectionService()

  async detect(frame: ImageData | string, options?: DetectionOptions): Promise<DetectedGarment> {
    if (options?.mode !== 'vision' || typeof frame !== 'string') {
      return this.local.detect(frame)
    }

    try {
      return await this.vision.detect(frame)
    } catch {
      const fallback = await this.local.detect(frame)
      return { ...fallback, fallback: true }
    }
  }
}
