import type {
  Garment,
  GarmentCategory,
  GarmentColor,
  GarmentFit,
  OutfitSlot,
  StyleProfile,
} from '../lib/types.ts'
import {
  SLOT_KEY_BY_SLOT,
  garmentLastWornAt,
  garmentWearCount,
  slotForCategory,
} from '../lib/types.ts'
import { daysSinceWorn } from '../lib/wear.ts'

/**
 * Mood/style direction for the AI Outfit Selector.
 */
export type Vibe =
  | 'casual'
  | 'formal'
  | 'college'
  | 'date'
  | 'party'
  | 'street'
  | 'minimal'

/**
 * Wardrobe metadata as the recommendation service sees it. Deliberately
 * excludes `image` (SVG art or captured-photo data URLs) — no image data
 * ever crosses the recommendation boundary. This is the only shape a
 * future text-based AI provider may receive.
 */
export interface GarmentDescriptor {
  id: string
  name: string
  category: GarmentCategory
  color: GarmentColor
  colorLabel: string
  fit: GarmentFit
  styleTags: string[]
  /** Optional signal — providers may use it to nudge toward favorites. */
  favorite?: boolean
  /** Confirmed wear count; used only for gentle recency nudges. */
  wearCount?: number
  /** Local days since the last confirmed wear; null = never worn. */
  lastWornDaysAgo?: number | null
}

/**
 * Strip image data at the service boundary — the one place this happens.
 * `lastWornDaysAgo` is resolved against today so providers stay deterministic
 * for a given request.
 */
export function toDescriptor(garment: Garment): GarmentDescriptor {
  return {
    id: garment.id,
    name: garment.name,
    category: garment.category,
    color: garment.color,
    colorLabel: garment.colorLabel,
    fit: garment.fit,
    styleTags: garment.styleTags,
    favorite: garment.favorite,
    wearCount: garmentWearCount(garment),
    lastWornDaysAgo: daysSinceWorn(garmentLastWornAt(garment)),
  }
}

/**
 * A recommendation, expressed as garment ids so any provider (local or
 * remote) only ever picks ids; the consumer resolves them against the
 * wardrobe. A slot is null when the wardrobe has nothing for that category.
 */
export interface RecommendedOutfit {
  topId: string | null
  bottomId: string | null
  shoesId: string | null
  /** Short editorial rationale shown in the UI. */
  rationale: string
}

/** Plain-text weather context passed to the recommendation service. */
export interface WeatherContext {
  city: string
  temperatureC: number
  condition: string
  humidity?: number
}

export interface OutfitRecommendationRequest {
  vibe: Vibe
  /** The user's wardrobe at request time (metadata only — no images). */
  wardrobe: GarmentDescriptor[]
  /** Current composition (descriptors) so the selector can build on it. */
  current: Partial<Record<GarmentCategory, GarmentDescriptor>>
  /**
   * Garment ids to avoid ("Try Another"): the provider must return a
   * different combination when alternatives exist. Empty/omitted = normal
   * recommendation.
   */
  exclude?: string[]
  /** Optional weather text — influences but never overrides the wardrobe. */
  weather?: WeatherContext
  /** Optional style preferences — text only, never images. */
  profile?: StyleProfile
}

/**
 * Typed failure surface for recommendation providers. A remote, text-based
 * model is expected to reject with one of these codes; the local mock
 * currently never throws, but the contract is the same for both.
 */
export type RecommendationErrorCode =
  | 'unsupported-vibe'
  | 'empty-wardrobe'
  | 'service-unavailable'
  | 'invalid-response'

export class RecommendationError extends Error {
  readonly code: RecommendationErrorCode

  constructor(code: RecommendationErrorCode, message: string) {
    super(message)
    this.name = 'RecommendationError'
    this.code = code
  }
}

/**
 * Pure post-processing of a raw provider response. Guards against the
 * failures a stochastic text model can produce — hallucinated ids,
 * missing slots, malformed text — and normalizes the result to the
 * contract the UI consumes. `availableIds` is the set of wardrobe ids
 * the request was built from.
 */
export function normalizeRecommendation(
  raw: RecommendedOutfit,
  availableIds: ReadonlySet<string>,
): RecommendedOutfit {
  const pick = (id: string | null): string | null =>
    id && availableIds.has(id) ? id : null

  return {
    topId: pick(raw.topId),
    bottomId: pick(raw.bottomId),
    shoesId: pick(raw.shoesId),
    rationale: raw.rationale.trim().slice(0, 240),
  }
}

/**
 * Outfit recommendation boundary. Implementations receive only metadata
 * descriptors and return id-based picks; they never receive or return
 * image data. The local mock is the reference implementation; a text-
 * based AI model replaces it later by implementing this interface.
 */
export interface OutfitRecommendationService {
  recommend(request: OutfitRecommendationRequest): Promise<RecommendedOutfit>
}

/**
 * Vibe → profile used by the local mock. Each profile carries the traits
 * the selector scores descriptors against so the heuristic reads like a
 * stylist's brief, not a pile of magic numbers.
 */
interface VibeProfile {
  label: string
  blurb: string
  /** Preferred style tags, most important first. */
  tags: string[]
  /** Per-category color preferences. */
  colors: Partial<Record<GarmentCategory, string[]>>
  /** Per-category fit preferences. */
  fits: Partial<Record<GarmentCategory, string[]>>
}

export const VIBES: Record<Vibe, VibeProfile> = {
  casual: {
    label: 'Casual',
    blurb: 'Easy, everyday ease.',
    tags: ['casual', 'everyday'],
    colors: {
      shirt: ['white', 'oat', 'olive'],
      pants: ['denim', 'sand'],
      shoes: ['white', 'tan'],
    },
    fits: {
      shirt: ['regular', 'relaxed'],
      pants: ['regular', 'relaxed'],
      shoes: ['regular'],
    },
  },
  formal: {
    label: 'Formal',
    blurb: 'Sharp, composed, tailored.',
    tags: ['formal', 'minimal'],
    colors: {
      shirt: ['white', 'navy'],
      pants: ['charcoal', 'black'],
      shoes: ['black'],
    },
    fits: {
      shirt: ['slim', 'regular'],
      pants: ['slim'],
      shoes: ['regular'],
    },
  },
  college: {
    label: 'College',
    blurb: 'Laid-back, campus-ready.',
    tags: ['casual', 'everyday', 'sporty'],
    colors: {
      shirt: ['oat', 'olive', 'navy'],
      pants: ['denim', 'sand'],
      shoes: ['white', 'tan'],
    },
    fits: {
      shirt: ['regular', 'relaxed'],
      pants: ['regular'],
      shoes: ['regular'],
    },
  },
  date: {
    label: 'Date',
    blurb: 'Polished, warm, memorable.',
    tags: ['smart-casual', 'evening'],
    colors: {
      shirt: ['navy', 'oat', 'olive'],
      pants: ['charcoal', 'black'],
      shoes: ['black', 'clay'],
    },
    fits: {
      shirt: ['slim', 'regular'],
      pants: ['slim', 'regular'],
      shoes: ['regular'],
    },
  },
  party: {
    label: 'Party',
    blurb: 'Bold, night-out energy.',
    tags: ['evening'],
    colors: {
      shirt: ['navy', 'black'],
      pants: ['black', 'charcoal'],
      shoes: ['black'],
    },
    fits: {
      shirt: ['slim'],
      pants: ['slim'],
      shoes: ['regular'],
    },
  },
  street: {
    label: 'Street',
    blurb: 'Edge with casual ease.',
    tags: ['casual', 'utility', 'sporty'],
    colors: {
      shirt: ['olive', 'black', 'white'],
      pants: ['denim', 'black'],
      shoes: ['white'],
    },
    fits: {
      shirt: ['relaxed', 'regular'],
      pants: ['regular', 'slim'],
      shoes: ['regular'],
    },
  },
  minimal: {
    label: 'Minimal',
    blurb: 'Quiet, curated restraint.',
    tags: ['minimal'],
    colors: {
      shirt: ['white', 'oat', 'navy'],
      pants: ['black', 'charcoal', 'sand'],
      shoes: ['black', 'tan', 'white'],
    },
    fits: {
      shirt: ['regular', 'slim'],
      pants: ['slim', 'regular'],
      shoes: ['regular'],
    },
  },
}

/** Display order for the vibe selector. */
export const VIBE_ORDER: Vibe[] = ['casual', 'formal', 'college', 'date', 'party', 'street', 'minimal']

/**
 * Local heuristic selector. It never inspects garment images — it scores
 * stored metadata (style tags, color, fit) against the vibe profile and
 * returns the best-scoring garment id per category, preferring a garment
 * already in the current composition when it ties. Pure and deterministic:
 * same request → same ids.
 */
export class MockOutfitRecommendationService implements OutfitRecommendationService {
  async recommend(request: OutfitRecommendationRequest): Promise<RecommendedOutfit> {
    const profile = VIBES[request.vibe]
    const excluded = new Set(request.exclude ?? [])
    // Slot-aware: every top-compatible category (shirt/blouse/top) competes
    // for the top slot, and bottoms (pants/jeans/skirt) for the bottom slot.
    // Legacy wardrobes behave exactly as before.
    const bySlot = (slot: OutfitSlot) =>
      request.wardrobe.filter((g) => slotForCategory(g.category) === slot)

    const pick = (slot: OutfitSlot): GarmentDescriptor | null => {
      let candidates = bySlot(slot)
      if (candidates.length === 0) return null
      // "Try Another": drop excluded ids, but only when alternatives
      // remain for this slot — never leave the slot empty over it.
      if (excluded.size > 0) {
        const remaining = candidates.filter((g) => !excluded.has(g.id))
        if (remaining.length > 0) candidates = remaining
      }
      // Profile preferences are keyed by the legacy slot key.
      const cat = SLOT_KEY_BY_SLOT[slot]
      const current = request.current[cat]

      const score = (g: GarmentDescriptor): number => {
        let s = 0
        profile.tags.forEach((tag, i) => {
          if (g.styleTags.includes(tag)) s += 3 - i * 0.25
        })
        const colors = profile.colors[cat] ?? []
        if (colors.includes(g.color)) s += 2
        const fits = profile.fits[cat] ?? []
        if (fits.includes(g.fit)) s += 1
        // Gentle favorite preference — a nudge on ties, never a mandate.
        if (g.favorite) s += 0.5
        // Wear recency: softly prefer ready pieces that have rested. Bounded
        // to ±0.4 — far below style, colour and weather weights — so it only
        // settles near-ties and never overrides the look or availability.
        const days = g.lastWornDaysAgo ?? null
        if (days === null || days >= 21) s += 0.4
        else if (days >= 8) s += 0.2
        else if (days <= 2) s -= 0.4
        else s -= 0.1
        // Style profile nudges: respect preferences without overriding.
        const p = request.profile
        if (p) {
          if (p.fit && g.fit === p.fit) s += 1
          if (p.favoriteColors.includes(g.color)) s += 0.75
          if (p.likes.some((taste) => g.styleTags.includes(taste))) s += 0.75
          if (p.avoids.some((taste) => g.styleTags.includes(taste))) s -= 1.5
        }
        // Weather-aware nudges: influence only, never override the wardrobe.
        const w = request.weather
        if (w) {
          const hot = w.temperatureC >= 26
          const cold = w.temperatureC <= 10
          const rainy = /rain|shower|storm|drizzle/i.test(w.condition)
          if (hot) {
            if (g.styleTags.includes('summer') || g.styleTags.includes('sporty')) s += 1
            if (g.color === 'white' || g.color === 'oat' || g.color === 'sand') s += 0.5
          }
          if (cold) {
            if (g.styleTags.includes('autumn') || g.styleTags.includes('evening')) s += 1
            if (g.color === 'navy' || g.color === 'charcoal' || g.color === 'black') s += 0.5
          }
          if (rainy) {
            if (g.styleTags.includes('suede')) s -= 1.5
            if (g.styleTags.includes('everyday') || g.styleTags.includes('casual')) s += 0.5
          }
        }
        return s
      }

      let best = candidates[0]
      let bestScore = score(best)
      for (const g of candidates.slice(1)) {
        const s = score(g)
        if (s > bestScore) {
          best = g
          bestScore = s
        }
      }
      // Keep the user's current pick on a tie — respect deliberate choices.
      if (current && score(current) === bestScore) return current
      return best
    }

    const top = pick('top')
    const bottom = pick('bottom')
    const shoes = pick('shoes')

    const named: string[] = []
    if (top) named.push(top.name)
    if (bottom) named.push(bottom.name)
    if (shoes) named.push(shoes.name)

    const rationale = named.length
      ? `${profile.label} edit — ${named.join(' with ')}. ${profile.blurb}`
      : `Your wardrobe is empty — scan items to build a ${profile.label.toLowerCase()} look.`

    return {
      topId: top?.id ?? null,
      bottomId: bottom?.id ?? null,
      shoesId: shoes?.id ?? null,
      rationale,
    }
  }
}
