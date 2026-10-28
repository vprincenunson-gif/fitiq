import {
  MockOutfitRecommendationService,
  RecommendationError,
  type OutfitRecommendationRequest,
  type OutfitRecommendationService,
  type RecommendedOutfit,
} from './recommend'

/**
 * Browser-side client for the server-side Groq proxy. The browser never
 * holds an API key — it posts vibe + metadata descriptors to the relative
 * route /api/recommend and receives an id-based recommendation. On any
 * transport/provider failure it transparently falls back to the local
 * mock service so the feature keeps working offline.
 */
export class RemoteOutfitRecommendationService implements OutfitRecommendationService {
  private readonly fallback: OutfitRecommendationService

  constructor(fallback: OutfitRecommendationService = new MockOutfitRecommendationService()) {
    this.fallback = fallback
  }

  async recommend(request: OutfitRecommendationRequest): Promise<RecommendedOutfit> {
    try {
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vibe: request.vibe,
          wardrobe: request.wardrobe,
          exclude: request.exclude ?? [],
          weather: request.weather ?? null,
          profile: request.profile ?? null,
        }),
      })

      if (!res.ok) {
        let code: RecommendationError['code'] = 'service-unavailable'
        try {
          const body = (await res.json()) as { code?: RecommendationError['code'] }
          if (body.code) code = body.code
        } catch {
          /* non-JSON error body — keep default code */
        }
        throw new RecommendationError(code, `Server route failed with ${res.status}`)
      }

      const data = (await res.json()) as Record<string, unknown>
      const pick = (v: unknown): string | null => (typeof v === 'string' ? v : null)
      return {
        topId: pick(data.topId),
        bottomId: pick(data.bottomId),
        shoesId: pick(data.shoesId),
        rationale: typeof data.rationale === 'string' ? data.rationale : '',
      }
    } catch (err) {
      if (err instanceof RecommendationError) {
        console.warn('[FITIQ] remote recommendation failed, using local fallback', err.code)
      } else {
        console.warn('[FITIQ] recommendation network error, using local fallback', err)
      }
      return this.fallback.recommend(request)
    }
  }
}
