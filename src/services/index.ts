import { type GarmentDetectionService } from './detection'
import { DetectionService } from './vision'
import { MockTryOnService, type TryOnService } from './tryon'
import { MockOutfitRecommendationService, type OutfitRecommendationService } from './recommend'
import { RemoteOutfitRecommendationService } from './remote'
import { LocalWeatherService, type WeatherService } from './weather'

/**
 * Service factory — the only place that decides which implementation is live.
 * Swap a mock for a real provider here; the rest of the app imports only the
 * interfaces from './detection' / './tryon' / './recommend'.
 *
 * Garment detection: local pixel analysis by default; the Groq Vision route
 * is used only after explicit photo-consent and falls back to local on failure.
 * Outfit recommendation: the remote (server-side Groq) provider is used when
 * VITE_RECOMMEND_PROVIDER=groq; otherwise the local mock runs. The remote
 * service falls back to the mock on any transport/provider failure.
 */
export const detectionService: GarmentDetectionService = new DetectionService()
export const tryOnService: TryOnService = new MockTryOnService()

const useRemoteRecommendation = import.meta.env.VITE_RECOMMEND_PROVIDER === 'groq'

export const outfitRecommendationService: OutfitRecommendationService = useRemoteRecommendation
  ? new RemoteOutfitRecommendationService()
  : new MockOutfitRecommendationService()

export const weatherService: WeatherService = new LocalWeatherService()
