/**
 * Shared Groq Vision core — the single source of truth for the
 * POST /api/detect-garment endpoint, used by:
 *   - the Vite dev/preview middleware (vite.config.ts),
 *   - the Node production server (server/index.mjs),
 *   - the Vercel serverless function (api/detect-garment.mjs).
 *
 * Privacy/security guarantees:
 *   - accepts exactly one field: a base64 data URL of the newly captured photo
 *   - validates MIME type, base64 payload and file signature
 *   - never writes, logs or persists the image (or any part of it)
 *   - never echoes the image back
 *   - GROQ_API_KEY is read from the server environment only, never from input
 *
 * This endpoint is intentionally separate from /api/recommend, which stays
 * strictly metadata-only (see server/groq.mjs).
 */

export const GROQ_VISION_MODEL = 'qwen/qwen3.8-27b'

/** Groq's OpenAI-compatible chat completion endpoint (vision-capable models). */
const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'

const MAX_IMAGE_BYTES = 2_000_000
const MAX_DATA_URL_CHARS = 2_800_000
const VISION_TIMEOUT_MS = 12_000

const CATEGORIES = ['shirt', 'pants', 'shoes']
const CATEGORY_SINGULAR = { shirt: 'Shirt', pants: 'Pants', shoes: 'Shoes' }

/**
 * Model colour vocabulary → internal token + display label. Several model
 * labels intentionally collapse onto FITIQ's fixed GarmentColor union.
 */
const COLORS = [
  ['light gray', 'oat', 'Light Gray'],
  ['light grey', 'oat', 'Light Gray'],
  ['off-white', 'white', 'Off-White'],
  ['off white', 'white', 'Off-White'],
  ['dark green', 'olive', 'Dark Green'],
  ['charcoal', 'charcoal', 'Charcoal'],
  ['beige', 'beige', 'Beige'],
  ['cream', 'beige', 'Cream'],
  ['navy', 'navy', 'Navy'],
  ['blue', 'blue', 'Blue'],
  ['denim', 'denim', 'Denim'],
  ['green', 'olive', 'Green'],
  ['olive', 'olive', 'Olive'],
  ['sage', 'olive', 'Sage'],
  ['white', 'white', 'White'],
  ['black', 'black', 'Black'],
  ['gray', 'charcoal', 'Gray'],
  ['grey', 'charcoal', 'Gray'],
  ['oat', 'oat', 'Oat'],
  ['red', 'clay', 'Red'],
  ['clay', 'clay', 'Clay'],
  ['pink', 'clay', 'Pink'],
  ['purple', 'clay', 'Purple'],
  ['yellow', 'sand', 'Yellow'],
  ['sand', 'sand', 'Sand'],
  ['tan', 'tan', 'Tan'],
  ['brown', 'tan', 'Brown'],
]

const PROMPT = [
  "You are FITIQ's garment vision classifier.",
  'Analyse ONLY the single garment shown in the photo. Ignore people, hangers, tags, watermarks, floor and background.',
  'Report the garment\'s actual dominant colour, not the background colour.',
  'Respond with STRICT JSON only, no markdown, no extra text, in this exact shape:',
  '{"category":"<shirt|pants|shoes>","color":"<colour token>","colorLabel":"<Colour>","name":"<Generic name>","confidence":<number 0-1>}',
  `The colour token MUST be one of: white, black, gray, charcoal, oat, beige, navy, blue, green, olive, red, clay, pink, purple, sand, tan, brown, yellow, denim.`,
  'category MUST be exactly one of: shirt, pants, shoes.',
  'name MUST be generic, e.g. "Blue Shirt", "Charcoal Pants", "Black Shoes". Never include brands or invented details.',
  'confidence MUST be a decimal between 0 and 1.',
].join('\n')

function hasValidSignature(buffer, mime) {
  if (mime === 'image/jpeg') {
    return buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
  }
  if (mime === 'image/png') {
    return (
      buffer.length > 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    )
  }
  if (mime === 'image/webp') {
    return (
      buffer.length > 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    )
  }
  return false
}

/**
 * Accept only one captured-image data URL. Metadata, prompts or any other
 * client-supplied fields are rejected so the route can't be repurposed.
 */
export function validateDetectBody(body) {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { status: 400, json: { code: 'invalid-image', message: 'Request body must be a JSON object.' } }
  }
  const keys = Object.keys(body)
  if (keys.length !== 1 || keys[0] !== 'image') {
    return {
      status: 400,
      json: { code: 'invalid-image', message: 'Only a single "image" field is accepted.' },
    }
  }

  const image = body.image
  if (typeof image !== 'string' || image.length === 0) {
    return { status: 400, json: { code: 'invalid-image', message: 'A captured image is required.' } }
  }
  if (image.length > MAX_DATA_URL_CHARS) {
    return {
      status: 413,
      json: { code: 'invalid-image', message: 'Photo is too large (2 MB maximum).' },
    }
  }

  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(image)
  if (!match) {
    return {
      status: 400,
      json: { code: 'invalid-image', message: 'Photo must be a JPEG, PNG or WebP base64 data URL.' },
    }
  }

  const mime = match[1]
  let buffer
  try {
    buffer = Buffer.from(match[2], 'base64')
  } catch {
    return { status: 400, json: { code: 'invalid-image', message: 'Photo could not be decoded.' } }
  }

  if (buffer.length < 1024 || buffer.length > MAX_IMAGE_BYTES) {
    return {
      status: 413,
      json: { code: 'invalid-image', message: 'Photo must be between 1 KB and 2 MB.' },
    }
  }
  if (!hasValidSignature(buffer, mime)) {
    return {
      status: 400,
      json: { code: 'invalid-image', message: 'Photo content does not match its file type.' },
    }
  }

  // The decoded buffer is deliberately not returned or logged.
  return { status: 200, json: { dataUrl: image } }
}

function canonicalColor(value) {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  if (!normalized) return null

  for (const [key, token, label] of COLORS) {
    if (normalized === key) return { token, label }
  }
  // Tolerate responses like "medium blue" or "navy blue" without letting a
  // hallucinated colour through: longest known colour string wins.
  const sorted = [...COLORS].sort((a, b) => b[0].length - a[0].length)
  for (const [key, token, label] of sorted) {
    if (new RegExp(`(^|[^a-z])${key}([^a-z]|$)`).test(normalized)) {
      return { token, label }
    }
  }
  return null
}

function parseJsonContent(content) {
  if (typeof content !== 'string') return null
  const trimmed = content
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    const start = trimmed.indexOf('{')
    const end = trimmed.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1))
      } catch {
        return null
      }
    }
    return null
  }
}

/** Validate/normalise the model's structured result. */
export function normalizeVisionResult(raw) {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null

  const category = typeof raw.category === 'string' ? raw.category.trim().toLowerCase() : ''
  if (!CATEGORIES.includes(category)) return null

  const color = canonicalColor(raw.color) ?? canonicalColor(raw.colorLabel)
  if (!color) return null

  const rawConfidence = typeof raw.confidence === 'number' ? raw.confidence : Number(raw.confidence)
  if (!Number.isFinite(rawConfidence)) return null
  const confidence = rawConfidence > 1 && rawConfidence <= 100 ? rawConfidence / 100 : rawConfidence
  if (confidence < 0 || confidence > 1) return null

  return {
    category,
    color: color.token,
    colorLabel: color.label,
    name: `${color.label} ${CATEGORY_SINGULAR[category]}`,
    confidence: Math.round(confidence * 100) / 100,
  }
}

/** Send the consented capture to Groq Vision. The image is never logged. */
export async function callGroqVision({ dataUrl }, apiKey) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), VISION_TIMEOUT_MS)

  try {
    const response = await fetch(GROQ_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GROQ_VISION_MODEL,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: PROMPT },
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          },
        ],
        temperature: 0,
        max_tokens: 200,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      // Drain the provider body without logging it — it may echo prompt data.
      await response.text().catch(() => '')
      console.warn(`[FITIQ] Groq Vision error ${response.status}`)
      return { status: 502, json: { code: 'service-unavailable', message: 'The AI vision provider returned an error.' } }
    }

    const data = await response.json()
    const content = data?.choices?.[0]?.message?.content
    const parsed = parseJsonContent(content)
    const result = normalizeVisionResult(parsed)
    if (!result) {
      console.warn('[FITIQ] Groq Vision returned an invalid result')
      return { status: 502, json: { code: 'invalid-response', message: 'The AI vision provider returned an invalid result.' } }
    }
    return { status: 200, json: result }
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError'
    // Log only the failure type — never the request/photo or provider payload.
    console.warn(`[FITIQ] Groq Vision request ${aborted ? 'timed out' : 'failed'}`)
    return { status: 504, json: { code: 'service-unavailable', message: 'The AI vision request failed or timed out.' } }
  } finally {
    clearTimeout(timer)
  }
}

/** One-shot convenience used by all hosts: validate → call → respond. */
export async function handleDetectBody(body, apiKey) {
  if (!apiKey) {
    return {
      status: 503,
      json: { code: 'service-unavailable', message: 'GROQ_API_KEY is not set on the server.' },
    }
  }
  const validated = validateDetectBody(body)
  if (validated.status !== 200) return validated
  return callGroqVision(validated.json, apiKey)
}
