/**
 * FITIQ production server (Node, zero dependencies).
 *
 * - Serves the built Vite frontend from /dist with SPA fallback.
 * - Handles POST /api/recommend securely: GROQ_API_KEY is read from the
 *   environment on the server only, never shipped to the browser.
 * - Accepts metadata-only descriptors (no images by whitelist).
 *
 * The Vite dev middleware (vite.config.ts) mirrors this endpoint for local
 * development; this file is the deployment artifact.
 */
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { join, extname, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const DIST_DIR = join(ROOT, 'dist')
const PORT = Number(process.env.PORT || 3000)

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_MODEL = 'openai/gpt-oss-20b'
const VIBES = ['casual', 'formal', 'college', 'date', 'party', 'street', 'minimal']

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
}

/* ── Sanitizers (strict whitelists — no images, ever) ── */

const ALLOWED_DESCRIPTOR_FIELDS = new Set([
  'id', 'name', 'category', 'color', 'colorLabel', 'fit', 'styleTags', 'favorite',
])

function sanitizeDescriptor(raw) {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  for (const key of Object.keys(raw)) {
    if (!ALLOWED_DESCRIPTOR_FIELDS.has(key)) return null
  }
  const styleTags = raw.styleTags
  if (!Array.isArray(styleTags) || !styleTags.every((t) => typeof t === 'string')) return null
  for (const field of ['id', 'name', 'category', 'color', 'colorLabel', 'fit']) {
    if (typeof raw[field] !== 'string' || !raw[field]) return null
  }
  if (raw.favorite !== undefined && typeof raw.favorite !== 'boolean') return null
  return {
    id: raw.id,
    name: raw.name,
    category: raw.category,
    color: raw.color,
    colorLabel: raw.colorLabel,
    fit: raw.fit,
    styleTags,
    favorite: raw.favorite,
  }
}

function sanitizeWeather(raw) {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  if (typeof raw.city !== 'string' || typeof raw.temperatureC !== 'number') return null
  if (raw.condition !== undefined && typeof raw.condition !== 'string') return null
  if (raw.humidity !== undefined && typeof raw.humidity !== 'number') return null
  return {
    city: raw.city.slice(0, 80),
    temperatureC: raw.temperatureC,
    condition: typeof raw.condition === 'string' ? raw.condition.slice(0, 40) : '',
    humidity: typeof raw.humidity === 'number' ? raw.humidity : undefined,
  }
}

const PROFILE_TASTES = ['minimal', 'casual', 'formal', 'street', 'sporty']
const PROFILE_FITS = ['slim', 'regular', 'relaxed']

function sanitizeProfile(raw) {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  if (raw.fit !== undefined && (typeof raw.fit !== 'string' || !PROFILE_FITS.includes(raw.fit))) {
    return null
  }
  const arr = (v, allowed) =>
    Array.isArray(v) && v.every((x) => typeof x === 'string' && allowed.includes(x))
  if (raw.favoriteColors !== undefined && !Array.isArray(raw.favoriteColors)) return null
  if (!arr(raw.likes, PROFILE_TASTES) || !arr(raw.avoids, PROFILE_TASTES)) return null
  return {
    fit: typeof raw.fit === 'string' ? raw.fit : undefined,
    favoriteColors: Array.isArray(raw.favoriteColors)
      ? raw.favoriteColors.filter((x) => typeof x === 'string').slice(0, 8)
      : undefined,
    likes: Array.isArray(raw.likes) ? raw.likes : undefined,
    avoids: Array.isArray(raw.avoids) ? raw.avoids : undefined,
  }
}

/* ── Prompt builder (text-only) ── */

function buildPrompt(vibe, wardrobe, excluded = [], weather = null, profile = null) {
  const items = wardrobe
    .map(
      (d) =>
        `- ${d.id}: ${d.name} (category=${d.category}, color=${d.color} "${d.colorLabel}", fit=${d.fit}, tags=${d.styleTags.join(',')}${d.favorite ? ', favorite' : ''})`,
    )
    .join('\n')

  const lines = [
    'You are FITIQ’s outfit stylist. Select exactly one shirt, one pair of pants, and one pair of shoes from the wardrobe that best fits the requested vibe.',
    '',
    `Vibe: ${vibe}`,
    '',
    'Wardrobe (metadata only):',
    items,
    '',
  ]

  if (excluded.length > 0) {
    lines.push(`Avoid these garments unless there is no alternative: ${excluded.join(', ')}`, '')
  }
  if (weather) {
    lines.push(
      `Today's weather in ${weather.city}: ${weather.temperatureC}°C, ${weather.condition}${weather.humidity !== undefined ? `, humidity ${weather.humidity}%` : ''}.`,
      'Let weather influence your picks (lighter pieces when hot, layers when cold, avoid rain-unsuitable items when wet), but only from the wardrobe above — never invent categories or pieces.',
      '',
    )
  }
  if (profile) {
    const parts = []
    if (profile.fit) parts.push(`preferred fit=${profile.fit}`)
    if (profile.favoriteColors?.length) parts.push(`favorite colors=[${profile.favoriteColors.join(', ')}]`)
    if (profile.likes?.length) parts.push(`likes=[${profile.likes.join(', ')}]`)
    if (profile.avoids?.length) parts.push(`avoids=[${profile.avoids.join(', ')}]`)
    lines.push(
      `User's style preferences: ${parts.join(', ')}.`,
      'Honour these preferences when possible, but only from the wardrobe above — never override the available pieces or invent items.',
      '',
    )
  }

  lines.push(
    'Respond with STRICT JSON only, no markdown, no extra text, in this exact shape:',
    '{"topId": "<garment id or null>", "bottomId": "<garment id or null>", "shoesId": "<garment id or null>", "rationale": "<one sentence, editorial tone>"}',
    '',
    'Use null for a category the wardrobe cannot cover. The rationale should name the chosen pieces.',
  )
  return lines.join('\n')
}

/* ── Request handling ── */

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        reject(new Error('Invalid JSON body'))
      }
    })
    req.on('error', reject)
  })
}

async function handleRecommend(req, res) {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    sendJson(res, 503, { code: 'service-unavailable', message: 'GROQ_API_KEY is not set on the server.' })
    return
  }

  let payload
  try {
    payload = await readBody(req)
  } catch {
    sendJson(res, 400, { code: 'invalid-response', message: 'Request body must be valid JSON.' })
    return
  }

  const vibe =
    typeof payload.vibe === 'string' && VIBES.includes(payload.vibe) ? payload.vibe : null
  if (!vibe) {
    sendJson(res, 400, { code: 'unsupported-vibe', message: 'Vibe must be one of ' + VIBES.join(', ') })
    return
  }
  if (!Array.isArray(payload.wardrobe)) {
    sendJson(res, 400, { code: 'invalid-response', message: 'wardrobe must be an array.' })
    return
  }
  const wardrobe = []
  for (const item of payload.wardrobe) {
    const clean = sanitizeDescriptor(item)
    if (!clean) {
      sendJson(res, 400, {
        code: 'invalid-response',
        message: 'Wardrobe items may contain metadata fields only (no images).',
      })
      return
    }
    wardrobe.push(clean)
  }

  const excluded = Array.isArray(payload.exclude)
    ? payload.exclude.filter((x) => typeof x === 'string')
    : []
  const weather = payload.weather === undefined ? null : sanitizeWeather(payload.weather)
  if (payload.weather !== undefined && !weather) {
    sendJson(res, 400, { code: 'invalid-response', message: 'weather must be text metadata.' })
    return
  }
  const profile = payload.profile === undefined ? null : sanitizeProfile(payload.profile)
  if (payload.profile !== undefined && !profile) {
    sendJson(res, 400, { code: 'invalid-response', message: 'profile must contain only text preferences.' })
    return
  }

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

    const data = await groqRes.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) {
      sendJson(res, 502, { code: 'invalid-response', message: 'AI provider returned an empty response.' })
      return
    }

    let parsed
    try {
      parsed = JSON.parse(content)
    } catch {
      sendJson(res, 502, { code: 'invalid-response', message: 'AI response was not valid JSON.' })
      return
    }

    const pick = (v) => (typeof v === 'string' ? v : null)
    sendJson(res, 200, {
      topId: pick(parsed.topId),
      bottomId: pick(parsed.bottomId),
      shoesId: pick(parsed.shoesId),
      rationale: typeof parsed.rationale === 'string' ? parsed.rationale : '',
    })
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError'
    console.warn('[FITIQ] Groq request failed', aborted ? 'timed out' : err)
    sendJson(res, 504, { code: 'service-unavailable', message: 'The AI provider request failed or timed out.' })
  } finally {
    clearTimeout(timer)
  }
}

/* ── Static serving + SPA fallback ── */

async function serveStatic(res, pathname) {
  const safePath = normalize(pathname).replace(/^(\.\.[\/])+/, '')
  let filePath = join(DIST_DIR, safePath)
  try {
    const st = await stat(filePath)
    if (st.isDirectory()) {
      filePath = join(filePath, 'index.html')
    }
  } catch {
    // SPA fallback: any non-API GET serves the app shell.
    filePath = join(DIST_DIR, 'index.html')
  }
  try {
    const body = await readFile(filePath)
    const ext = extname(filePath).toLowerCase()
    res.writeHead(200, {
      'Content-Type': MIME[ext] ?? 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
    })
    res.end(body)
  } catch {
    sendJson(res, 500, { code: 'invalid-response', message: 'Frontend build not found. Run `npm run build` first.' })
  }
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)

  if (req.method === 'POST' && url.pathname === '/api/recommend') {
    void handleRecommend(req, res)
    return
  }
  if (req.method === 'GET' && url.pathname.startsWith('/api/')) {
    sendJson(res, 404, { code: 'invalid-response', message: 'Unknown API route.' })
    return
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    sendJson(res, 405, { code: 'invalid-response', message: 'Method not allowed.' })
    return
  }

  void serveStatic(res, url.pathname)
})

server.listen(PORT, () => {
  console.log(`[FITIQ] production server listening on http://localhost:${PORT}`)
  if (!process.env.GROQ_API_KEY) {
    console.warn('[FITIQ] GROQ_API_KEY is not set — /api/recommend will return 503 (mock fallback in app covers UX).')
  }
})
