import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'

/**
 * FITIQ server-side AI proxy — a Vite dev/preview middleware that keeps the
 * Groq API key on the server. The browser only ever talks to /api/recommend;
 * the key is read from process.env on the server and is never bundled.
 *
 * The route accepts ONLY metadata descriptors (no images, URLs, or data
 * URLs by construction — the whitelist below drops everything else) and
 * returns a JSON recommendation that the client validates again.
 */

interface Descriptor {
  id: string
  name: string
  category: string
  color: string
  colorLabel: string
  fit: string
  styleTags: string[]
  favorite?: boolean
}

const ALLOWED_DESCRIPTOR_FIELDS = new Set([
  'id', 'name', 'category', 'color', 'colorLabel', 'fit', 'styleTags', 'favorite',
])

/** Keep only known metadata fields; any stray image payload is discarded. */
function sanitizeDescriptor(raw: unknown): Descriptor | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  const rec = raw as Record<string, unknown>
  for (const key of Object.keys(rec)) {
    if (!ALLOWED_DESCRIPTOR_FIELDS.has(key)) return null
  }
  const styleTags = rec.styleTags
  if (!Array.isArray(styleTags) || !styleTags.every((t) => typeof t === 'string')) return null
  for (const field of ['id', 'name', 'category', 'color', 'colorLabel', 'fit']) {
    if (typeof rec[field] !== 'string' || !rec[field]) return null
  }
  if (rec.favorite !== undefined && typeof rec.favorite !== 'boolean') return null
  return {
    id: rec.id as string,
    name: rec.name as string,
    category: rec.category as string,
    color: rec.color as string,
    colorLabel: rec.colorLabel as string,
    fit: rec.fit as string,
    styleTags: styleTags as string[],
    favorite: rec.favorite as boolean | undefined,
  }
}

const VIBES = ['casual', 'formal', 'college', 'date', 'party', 'street', 'minimal']

interface WeatherRaw {
  city: string
  temperatureC: number
  condition: string
  humidity?: number
}

const PROFILE_TASTES = ['minimal', 'casual', 'formal', 'street', 'sporty']
const PROFILE_FITS = ['slim', 'regular', 'relaxed']

interface ProfileRaw {
  fit?: string
  favoriteColors?: string[]
  likes?: string[]
  avoids?: string[]
}

/** Style profile arrives as plain text preferences only — nothing else. */
function sanitizeProfile(raw: unknown): ProfileRaw | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  const rec = raw as Record<string, unknown>
  if (rec.fit !== undefined && (typeof rec.fit !== 'string' || !PROFILE_FITS.includes(rec.fit))) {
    return null
  }
  const arr = (v: unknown, allowed: string[]) =>
    Array.isArray(v) &&
    v.every((x) => typeof x === 'string' && (allowed.length === 0 || allowed.includes(x)))
  if (rec.favoriteColors !== undefined && !Array.isArray(rec.favoriteColors)) return null
  if (!arr(rec.likes, PROFILE_TASTES) || !arr(rec.avoids, PROFILE_TASTES)) return null
  return {
    fit: typeof rec.fit === 'string' ? rec.fit : undefined,
    favoriteColors: Array.isArray(rec.favoriteColors)
      ? rec.favoriteColors.filter((x): x is string => typeof x === 'string').slice(0, 8)
      : undefined,
    likes: Array.isArray(rec.likes) ? (rec.likes as string[]) : undefined,
    avoids: Array.isArray(rec.avoids) ? (rec.avoids as string[]) : undefined,
  }
}

/** Weather arrives as plain text metadata only — nothing else is accepted. */
function sanitizeWeather(raw: unknown): WeatherRaw | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  const rec = raw as Record<string, unknown>
  if (typeof rec.city !== 'string' || typeof rec.temperatureC !== 'number') return null
  if (rec.condition !== undefined && typeof rec.condition !== 'string') return null
  if (rec.humidity !== undefined && typeof rec.humidity !== 'number') return null
  return {
    city: rec.city.slice(0, 80),
    temperatureC: rec.temperatureC,
    condition: typeof rec.condition === 'string' ? rec.condition.slice(0, 40) : '',
    humidity: typeof rec.humidity === 'number' ? rec.humidity : undefined,
  }
}

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_MODEL = 'openai/gpt-oss-20b'

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown)
      } catch {
        reject(new Error('Invalid JSON body'))
      }
    })
    req.on('error', reject)
  })
}

/**
 * Build a text-only prompt from vibe + descriptors. Only metadata is ever
 * serialized here — never images, URLs, or data URLs.
 */
function buildPrompt(
  vibe: string,
  wardrobe: Descriptor[],
  excluded: string[] = [],
  weather?: WeatherRaw | null,
  profile?: ProfileRaw | null,
): string {
  const items = wardrobe
    .map(
      (d) =>
        `- ${d.id}: ${d.name} (category=${d.category}, color=${d.color} "${d.colorLabel}", fit=${d.fit}, tags=${d.styleTags.join(',')}${d.favorite ? ', favorite' : ''})`,
    )
    .join('\n')

  return [
    'You are FITIQ’s outfit stylist. Select exactly one shirt, one pair of pants, and one pair of shoes from the wardrobe that best fits the requested vibe.',
    '',
    `Vibe: ${vibe}`,
    '',
    'Wardrobe (metadata only):',
    items,
    '',
    ...(excluded.length > 0
      ? [`Avoid these garments unless there is no alternative: ${excluded.join(', ')}`, '']
      : []),
    ...(weather
      ? [
          `Today's weather in ${weather.city}: ${weather.temperatureC}°C, ${weather.condition}${weather.humidity !== undefined ? `, humidity ${weather.humidity}%` : ''}.`,
          'Let weather influence your picks (lighter pieces when hot, layers when cold, avoid rain-unsuitable items when wet), but only from the wardrobe above — never invent categories or pieces.',
          '',
        ]
      : []),
    ...(profile
      ? [
          `User's style preferences:${profile.fit ? ` preferred fit=${profile.fit},` : ''}${profile.favoriteColors?.length ? ` favorite colors=[${profile.favoriteColors.join(', ')}],` : ''}${profile.likes?.length ? ` likes=[${profile.likes.join(', ')}],` : ''}${profile.avoids?.length ? ` avoids=[${profile.avoids.join(', ')}]` : ''}`.replace(/,\s*$/, '') + '.',
          'Honour these preferences when possible, but only from the wardrobe above — never override the available pieces or invent items.',
          '',
        ]
      : []),
    'Respond with STRICT JSON only, no markdown, no extra text, in this exact shape:',
    '{"topId": "<garment id or null>", "bottomId": "<garment id or null>", "shoesId": "<garment id or null>", "rationale": "<one sentence, editorial tone>"}',
    '',
    'Use null for a category the wardrobe cannot cover. The rationale should name the chosen pieces.',
  ].join('\n')
}

async function handleRecommend(req: IncomingMessage, res: ServerResponse, apiKey: string) {

  let payload: unknown
  try {
    payload = await readBody(req)
  } catch {
    sendJson(res, 400, { code: 'invalid-response', message: 'Request body must be valid JSON.' })
    return
  }

  const body = payload as { vibe?: unknown; wardrobe?: unknown; exclude?: unknown; weather?: unknown; profile?: unknown }
  const vibe = typeof body.vibe === 'string' && VIBES.includes(body.vibe) ? body.vibe : null
  if (!vibe) {
    sendJson(res, 400, { code: 'unsupported-vibe', message: 'Vibe must be one of ' + VIBES.join(', ') })
    return
  }
  const excluded = Array.isArray(body.exclude)
    ? body.exclude.filter((x): x is string => typeof x === 'string')
    : []
  const weather = body.weather === undefined ? null : sanitizeWeather(body.weather)
  if (body.weather !== undefined && !weather) {
    sendJson(res, 400, { code: 'invalid-response', message: 'weather must be text metadata (city, temperatureC, condition, humidity).' })
    return
  }
  const profile = body.profile === undefined ? null : sanitizeProfile(body.profile)
  if (body.profile !== undefined && !profile) {
    sendJson(res, 400, { code: 'invalid-response', message: 'profile must contain only text preferences (fit, favoriteColors, likes, avoids).' })
    return
  }
  if (!Array.isArray(body.wardrobe)) {
    sendJson(res, 400, { code: 'invalid-response', message: 'wardrobe must be an array.' })
    return
  }
  const wardrobe: Descriptor[] = []
  for (const item of body.wardrobe) {
    const clean = sanitizeDescriptor(item)
    if (!clean) {
      sendJson(res, 400, { code: 'invalid-response', message: 'Wardrobe items may contain metadata fields only (no images).' })
      return
    }
    wardrobe.push(clean)
  }

  // Text-only request: the prompt contains metadata only. No image data
  // is ever constructed, referenced, or attached anywhere in this route.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15000)

  try {
    const groqRes = await fetch(GROQ_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: 'user', content: buildPrompt(vibe, wardrobe, excluded, weather, profile) }],
        temperature: 0.6,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    })

    if (!groqRes.ok) {
      const detail = await groqRes.text().catch(() => '')
      console.warn(`[FITIQ] Groq error ${groqRes.status}: ${detail.slice(0, 300)}`)
      sendJson(res, 502, { code: 'service-unavailable', message: 'The AI provider returned an error.' })
      return
    }

    const data = (await groqRes.json()) as { choices?: { message?: { content?: string } }[] }
    const content = data.choices?.[0]?.message?.content
    if (!content) {
      sendJson(res, 502, { code: 'invalid-response', message: 'AI provider returned an empty response.' })
      return
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(content)
    } catch {
      sendJson(res, 502, { code: 'invalid-response', message: 'AI response was not valid JSON.' })
      return
    }

    const rec = parsed as Record<string, unknown>
    const pick = (v: unknown): string | null =>
      typeof v === 'string' ? v : null
    sendJson(res, 200, {
      topId: pick(rec.topId),
      bottomId: pick(rec.bottomId),
      shoesId: pick(rec.shoesId),
      rationale: typeof rec.rationale === 'string' ? rec.rationale : '',
    })
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError'
    console.warn('[FITIQ] Groq request failed', aborted ? 'timed out' : err)
    sendJson(res, 504, { code: 'service-unavailable', message: 'The AI provider request failed or timed out.' })
  } finally {
    clearTimeout(timer)
  }
}

function recommendPlugin(groqApiKey: string): Plugin {
  const middleware = (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (req.method === 'POST' && req.url === '/api/recommend') {
      void handleRecommend(req, res, groqApiKey)
    } else {
      next()
    }
  }
  return {
    name: 'fitiq-groq-proxy',
    configureServer(server) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Vite does not push .env into process.env — load it explicitly so the
  // server route can read GROQ_API_KEY. (Shell-exported keys still win.)
  const env = loadEnv(mode, process.cwd(), '')
  const groqApiKey = process.env.GROQ_API_KEY ?? env.GROQ_API_KEY ?? ''
  return {
    plugins: [react(), tailwindcss(), recommendPlugin(groqApiKey)],
  }
})
