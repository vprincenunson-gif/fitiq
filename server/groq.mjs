/**
 * Shared Groq recommendation core — the single source of truth for the
 * /api/recommend endpoint, used by:
 *   - the Vite dev middleware (vite.config.ts),
 *   - the Node production server (server/index.mjs),
 *   - the Vercel serverless function (api/recommend.mjs).
 *
 * Metadata-only by construction: descriptors are whitelisted field by field,
 * and anything else (including any image payload) is rejected. The Groq
 * key is always provided by the caller from the environment — never from
 * client input.
 */

export const VIBES = ['casual', 'formal', 'college', 'date', 'party', 'street', 'minimal']

export const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'
export const GROQ_MODEL = 'openai/gpt-oss-20b'

const ALLOWED_DESCRIPTOR_FIELDS = new Set([
  'id', 'name', 'category', 'color', 'colorLabel', 'fit', 'styleTags', 'favorite',
  'wearCount', 'lastWornDaysAgo',
])

export function sanitizeDescriptor(raw) {
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
  if (
    raw.wearCount !== undefined &&
    (typeof raw.wearCount !== 'number' || !Number.isFinite(raw.wearCount) || raw.wearCount < 0)
  ) {
    return null
  }
  if (
    raw.lastWornDaysAgo !== undefined &&
    raw.lastWornDaysAgo !== null &&
    (typeof raw.lastWornDaysAgo !== 'number' ||
      !Number.isFinite(raw.lastWornDaysAgo) ||
      raw.lastWornDaysAgo < 0)
  ) {
    return null
  }
  return {
    id: raw.id,
    name: raw.name,
    category: raw.category,
    color: raw.color,
    colorLabel: raw.colorLabel,
    fit: raw.fit,
    styleTags,
    favorite: raw.favorite,
    wearCount: raw.wearCount,
    lastWornDaysAgo: raw.lastWornDaysAgo,
  }
}

export function sanitizeWeather(raw) {
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

export function sanitizeProfile(raw) {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  // null fit = "no preference" (the app's default), treated as absent.
  if (raw.fit != null && (typeof raw.fit !== 'string' || !PROFILE_FITS.includes(raw.fit))) {
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

export function buildPrompt(vibe, wardrobe, excluded = [], weather = null, profile = null) {
  const items = wardrobe
    .map((d) => {
      const wear =
        typeof d.lastWornDaysAgo === 'number'
          ? `, last worn ${d.lastWornDaysAgo}d ago`
          : d.lastWornDaysAgo === null
            ? ', never worn'
            : ''
      const count =
        typeof d.wearCount === 'number' && d.wearCount > 0 ? `, worn ${d.wearCount}x` : ''
      return `- ${d.id}: ${d.name} (category=${d.category}, color=${d.color} "${d.colorLabel}", fit=${d.fit}, tags=${d.styleTags.join(',')}${d.favorite ? ', favorite' : ''}${wear}${count})`
    })
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

  if (wardrobe.some((d) => d.lastWornDaysAgo !== undefined || d.wearCount !== undefined)) {
    lines.push(
      'Wear recency: softly prefer pieces worn least recently (or never worn). Treat this as a tie-breaker only — vibe, weather, the user’s style preferences and the available wardrobe always take precedence.',
      '',
    )
  }

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

/**
 * Validate a raw request body and return { status, json }.
 * Pure and environment-agnostic, so every host returns identical errors.
 */
export function validateRequestBody(body) {
  const vibe = typeof body?.vibe === 'string' && VIBES.includes(body.vibe) ? body.vibe : null
  if (!vibe) {
    return { status: 400, json: { code: 'unsupported-vibe', message: 'Vibe must be one of ' + VIBES.join(', ') } }
  }
  if (!Array.isArray(body.wardrobe)) {
    return { status: 400, json: { code: 'invalid-response', message: 'wardrobe must be an array.' } }
  }
  const wardrobe = []
  for (const item of body.wardrobe) {
    const clean = sanitizeDescriptor(item)
    if (!clean) {
      return {
        status: 400,
        json: { code: 'invalid-response', message: 'Wardrobe items may contain metadata fields only (no images).' },
      }
    }
    wardrobe.push(clean)
  }

  const excluded = Array.isArray(body.exclude)
    ? body.exclude.filter((x) => typeof x === 'string')
    : []
  // null / undefined both mean "not provided" — the client sends null
  // when it has no weather or profile to include.
  const weather = body.weather == null ? null : sanitizeWeather(body.weather)
  if (body.weather != null && !weather) {
    return { status: 400, json: { code: 'invalid-response', message: 'weather must be text metadata.' } }
  }
  const profile = body.profile == null ? null : sanitizeProfile(body.profile)
  if (body.profile != null && !profile) {
    return { status: 400, json: { code: 'invalid-response', message: 'profile must contain only text preferences.' } }
  }

  return { status: 200, json: { vibe, wardrobe, excluded, weather, profile } }
}

/**
 * Call Groq for a validated request. Returns { status, json }.
 * `apiKey` must come from the server environment.
 */
export async function callGroq({ vibe, wardrobe, excluded, weather, profile }, apiKey) {
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
      return { status: 502, json: { code: 'service-unavailable', message: 'The AI provider returned an error.' } }
    }

    const data = await groqRes.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) {
      return { status: 502, json: { code: 'invalid-response', message: 'AI provider returned an empty response.' } }
    }

    let parsed
    try {
      parsed = JSON.parse(content)
    } catch {
      return { status: 502, json: { code: 'invalid-response', message: 'AI response was not valid JSON.' } }
    }

    const pick = (v) => (typeof v === 'string' ? v : null)
    return {
      status: 200,
      json: {
        topId: pick(parsed.topId),
        bottomId: pick(parsed.bottomId),
        shoesId: pick(parsed.shoesId),
        rationale: typeof parsed.rationale === 'string' ? parsed.rationale : '',
      },
    }
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError'
    console.warn('[FITIQ] Groq request failed', aborted ? 'timed out' : err)
    return { status: 504, json: { code: 'service-unavailable', message: 'The AI provider request failed or timed out.' } }
  } finally {
    clearTimeout(timer)
  }
}

/** One-shot convenience used by all hosts: validate → call → respond. */
export async function handleRecommendBody(body, apiKey) {
  if (!apiKey) {
    return { status: 503, json: { code: 'service-unavailable', message: 'GROQ_API_KEY is not set on the server.' } }
  }
  const validated = validateRequestBody(body)
  if (validated.status !== 200) return validated
  return callGroq(validated.json, apiKey)
}
