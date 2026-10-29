import type { DetectedGarment, GarmentCategory, GarmentColor } from '../lib/types'
import { genericGarmentName } from '../lib/types'

/**
 * Where scan metadata comes from:
 *  - `local`: pixel analysis in the browser (no upload)
 *  - `vision`: the server-side Groq Vision route (only after consent)
 */
export type DetectionMode = 'local' | 'vision'

export interface DetectionOptions {
  mode?: DetectionMode
}

/**
 * Future AI vision boundary: classify a captured camera frame and return the
 * detected garment. Implementations must never infer consent themselves —
 * callers pass the explicit mode selected by the user.
 */
export interface GarmentDetectionService {
  detect(frame: ImageData | string, options?: DetectionOptions): Promise<DetectedGarment>
}

/** Category is confirmed/edited by the user; local analysis cannot infer it. */
const DEFAULT_CATEGORY: GarmentCategory = 'shirt'

/** Only needed so the detection overlay does not flicker. */
const DETECTION_DELAY_MS = 700

const SAMPLE_SIZE = 64
/** Central square of the photo — avoids letterbox bars and most background. */
const CENTER_CROP = 0.6
/** Coloured pixels must make up this share before we trust them over neutrals. */
const CHROMATIC_SHARE = 0.12

interface Hsl {
  h: number
  s: number
  l: number
}

interface Sample {
  r: number
  g: number
  b: number
  h: number
  s: number
  l: number
}

interface ColorResult {
  color: GarmentColor
  label: string
}

const NEUTRAL_FALLBACK: ColorResult = { color: 'oat', label: 'Neutral' }

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function rgbToHsl(r: number, g: number, b: number): Hsl {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2

  if (max === min) return { h: 0, s: 0, l }

  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

  let h: number
  switch (max) {
    case rn:
      h = (gn - bn) / d + (gn < bn ? 6 : 0)
      break
    case gn:
      h = (bn - rn) / d + 2
      break
    default:
      h = (rn - gn) / d + 4
  }
  return { h: h * 60, s, l }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('frame-load-failed'))
    image.src = src
  })
}

/** Decode the captured data URL into a small, centre-cropped colour sample. */
async function frameToImageData(frame: string): Promise<ImageData> {
  const image = await loadImage(frame)
  const side = Math.min(image.naturalWidth, image.naturalHeight) * CENTER_CROP
  if (!side) throw new Error('empty-frame')

  const canvas = document.createElement('canvas')
  canvas.width = SAMPLE_SIZE
  canvas.height = SAMPLE_SIZE
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('no-canvas')

  const sx = (image.naturalWidth - side) / 2
  const sy = (image.naturalHeight - side) / 2
  ctx.drawImage(image, sx, sy, side, side, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE)
  return ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE)
}

function collectSamples(image: ImageData): Sample[] {
  const samples: Sample[] = []
  const { data } = image
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const { h, s, l } = rgbToHsl(r, g, b)
    samples.push({ r, g, b, h, s, l })
  }
  return samples
}

/**
 * Pick the most common 4-bit colour bucket. Colourful pixels are preferred
 * when they are a meaningful share of the frame, so a blue shirt wins over a
 * white wall instead of averaging the two into grey.
 */
function dominantSample(samples: Sample[]): Sample | null {
  if (samples.length === 0) return null

  const chromatic = samples.filter(
    (p) => p.s >= 0.15 && p.l > 0.08 && p.l < 0.96,
  )
  const pool =
    chromatic.length >= samples.length * CHROMATIC_SHARE ? chromatic : samples

  const buckets = new Map<
    number,
    { count: number; r: number; g: number; b: number }
  >()
  for (const p of pool) {
    const key = ((p.r >> 4) << 8) | ((p.g >> 4) << 4) | (p.b >> 4)
    const bucket = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0 }
    bucket.count += 1
    bucket.r += p.r
    bucket.g += p.g
    bucket.b += p.b
    buckets.set(key, bucket)
  }

  let best: { count: number; r: number; g: number; b: number } | null = null
  for (const bucket of buckets.values()) {
    if (!best || bucket.count > best.count) best = bucket
  }
  if (!best) return null

  const r = best.r / best.count
  const g = best.g / best.count
  const b = best.b / best.count
  return { r, g, b, ...rgbToHsl(r, g, b) }
}

/** Map a representative RGB value onto FITIQ's garment colour vocabulary. */
function classifyColor(r: number, g: number, b: number): ColorResult {
  const { h, s, l } = rgbToHsl(r, g, b)

  if (l < 0.12) return { color: 'black', label: 'Black' }

  // Whites and greys: low saturation, or a very light near-neutral.
  if (s < 0.12 || (l > 0.86 && s < 0.18)) {
    if (l >= 0.88) return { color: 'white', label: 'White' }
    if (l >= 0.62) return { color: 'oat', label: 'Light Gray' }
    if (l >= 0.3) return { color: 'charcoal', label: 'Gray' }
    return { color: 'black', label: 'Black' }
  }

  // Warm low-chroma tones read as beige/sand/tan rather than yellow/brown.
  if (h >= 20 && h < 60 && s < 0.4) {
    if (l >= 0.8) return { color: 'beige', label: 'Beige' }
    if (l >= 0.6) return { color: 'sand', label: 'Sand' }
    return { color: 'tan', label: 'Tan' }
  }

  // Blue / navy — the common case this fix targets.
  if (h >= 170 && h <= 260) {
    if (l < 0.32) return { color: 'navy', label: 'Navy' }
    return { color: 'blue', label: 'Blue' }
  }

  // Greens.
  if (h > 60 && h < 170) {
    if (l < 0.25) return { color: 'olive', label: 'Dark Green' }
    if (l > 0.7 && s < 0.5) return { color: 'olive', label: 'Sage' }
    return { color: 'olive', label: 'Green' }
  }

  // Yellows / oranges / browns.
  if (h >= 20 && h < 70) {
    if (l > 0.6) return { color: 'sand', label: 'Yellow' }
    return { color: 'tan', label: 'Brown' }
  }

  // Reds, pinks and the small purple band.
  if (l > 0.7) return { color: 'clay', label: 'Pink' }
  if (h < 20 || h >= 340) return { color: 'clay', label: 'Red' }
  return { color: 'clay', label: 'Purple' }
}

async function analyzeFrame(frame: ImageData | string): Promise<ColorResult> {
  const image = typeof frame === 'string' ? await frameToImageData(frame) : frame
  const sample = dominantSample(collectSamples(image))
  if (!sample) return NEUTRAL_FALLBACK
  return classifyColor(sample.r, sample.g, sample.b)
}

/**
 * Local detector: analyses the capture's colour and returns generic metadata
 * only. The captured photo itself is passed through untouched as `image`, so
 * the original is what gets stored in the wardrobe.
 */
export class LocalDetectionService implements GarmentDetectionService {
  async detect(frame: ImageData | string): Promise<DetectedGarment> {
    await delay(DETECTION_DELAY_MS)

    let result: ColorResult = NEUTRAL_FALLBACK
    try {
      if (frame) result = await analyzeFrame(frame)
    } catch {
      // Unreadable frame: fall back to neutral metadata the user can edit.
    }

    return {
      category: DEFAULT_CATEGORY,
      color: result.color,
      colorLabel: result.label,
      name: genericGarmentName(result.label, DEFAULT_CATEGORY),
      // No seeded style tags or fits; these are user-editable later.
      styleTags: [],
      fit: 'regular',
      image: typeof frame === 'string' ? frame : '',
      source: 'local',
    }
  }
}
