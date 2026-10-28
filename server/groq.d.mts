/**
 * Ambient typings for server/groq.mjs (shared, host-agnostic Groq core).
 * The .mjs file holds the implementation; this declaration lets TS callers
 * (vite.config.ts) import it safely.
 */
export declare const VIBES: string[]
export declare const GROQ_ENDPOINT: string
export declare const GROQ_MODEL: string

export interface Descriptor {
  id: string
  name: string
  category: string
  color: string
  colorLabel: string
  fit: string
  styleTags: string[]
  favorite?: boolean
}

export interface WeatherRaw {
  city: string
  temperatureC: number
  condition: string
  humidity?: number
}

export interface ProfileRaw {
  fit?: string
  favoriteColors?: string[]
  likes?: string[]
  avoids?: string[]
}

export function sanitizeDescriptor(raw: unknown): Descriptor | null
export function sanitizeWeather(raw: unknown): WeatherRaw | null
export function sanitizeProfile(raw: unknown): ProfileRaw | null
export function buildPrompt(
  vibe: string,
  wardrobe: Descriptor[],
  excluded?: string[],
  weather?: WeatherRaw | null,
  profile?: ProfileRaw | null,
): string

export interface ValidatedRequest {
  vibe: string
  wardrobe: Descriptor[]
  excluded: string[]
  weather: WeatherRaw | null
  profile: ProfileRaw | null
}

export function validateRequestBody(body: unknown): { status: number; json: ValidatedRequest | { code: string; message: string } }
export function callGroq(request: ValidatedRequest, apiKey: string): Promise<{ status: number; json: Record<string, unknown> }>
export function handleRecommendBody(body: unknown, apiKey: string | undefined): Promise<{ status: number; json: Record<string, unknown> }>
