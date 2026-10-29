import { useRef, useState } from 'react'
import type { Garment, GarmentCategory, OutfitComposition, StyleProfile } from '../../lib/types'
import { isWearable } from '../../lib/types'
import { RecommendationError, VIBES, VIBE_ORDER, normalizeRecommendation, toDescriptor, type RecommendedOutfit, type Vibe, type WeatherContext } from '../../services/recommend'
import { outfitRecommendationService } from '../../services'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'
import { Tag } from '../ui/Tag'

interface VibeSelectorProps {
  wardrobe: Garment[]
  current: OutfitComposition
  onAdd: (garment: { id: string; category: GarmentCategory }) => void
  /** Called with the vibe + applied garment ids after each successful AI build. */
  onOutfitGenerated?: (vibe: Vibe, ids: string[]) => void
  /** Plain-text weather context from the WeatherCard (optional). */
  weather?: WeatherContext | null
  /** Text-only style preferences from "My Style" (optional). */
  profile?: StyleProfile | null
}

/**
 * "What's the vibe?" — the AI Outfit Selector panel.
 * Picks a mood, taps Build My Fit, and the recommendation service composes
 * one top, bottom and shoes from wardrobe metadata. Only ids cross the
 * service boundary; the UI resolves them back to garments here.
 */
export function VibeSelector({ wardrobe, current, onAdd, onOutfitGenerated, weather, profile }: VibeSelectorProps) {
  const [vibe, setVibe] = useState<Vibe | null>(null)
  const [working, setWorking] = useState(false)
  const [result, setResult] = useState<RecommendedOutfit | null>(null)
  const [error, setError] = useState<string | null>(null)
  const buildRun = useRef(0)
  // Ids seen so far for the current vibe — "Try Another" asks for a
  // different combination without repeating these.
  const excludeRef = useRef<string[]>([])

  const messageForError = (err: unknown): string => {
    if (err instanceof RecommendationError) {
      switch (err.code) {
        case 'unsupported-vibe':
          return "That vibe isn't supported right now — pick another."
        case 'empty-wardrobe':
          return 'Your wardrobe is empty — scan items first.'
        case 'service-unavailable':
          return 'The stylist service is unavailable. Try again in a moment.'
        case 'invalid-response':
          return 'The stylist returned an unexpected result. Try again.'
      }
    }
    return 'Something went wrong while building your look. Try again.'
  }

  const build = async () => {
    if (!vibe || working) return
    const run = ++buildRun.current
    setWorking(true)
    setResult(null)
    setError(null)
    // Only garments currently ready to wear are eligible — items marked
    // Needs ironing / Worn / In laundry stay out of every recommendation.
    const eligible = wardrobe.filter(isWearable)
    if (eligible.length === 0) {
      setError(
        'Nothing is ready to wear right now — set at least one item to “Ready” in your Wardrobe, then build your fit again.',
      )
      setWorking(false)
      return
    }
    try {
      const raw = await outfitRecommendationService.recommend({
        vibe,
        wardrobe: eligible.map(toDescriptor),
        current: {
          shirt: current.top && isWearable(current.top) ? toDescriptor(current.top) : undefined,
          pants: current.bottom && isWearable(current.bottom) ? toDescriptor(current.bottom) : undefined,
          shoes: current.shoes && isWearable(current.shoes) ? toDescriptor(current.shoes) : undefined,
        },
        exclude: excludeRef.current,
        weather: weather ?? undefined,
        profile: profile ?? undefined,
      })
      if (run !== buildRun.current) return // stale — a newer build superseded this
      const recommended = normalizeRecommendation(
        raw,
        new Set(eligible.map((g) => g.id)),
      )
      const appliedIds: string[] = []
      ;[recommended.topId, recommended.bottomId, recommended.shoesId].forEach((id) => {
        if (!id) return
        const garment = eligible.find((g) => g.id === id)
        if (garment) {
          onAdd({ id: garment.id, category: garment.category })
          appliedIds.push(garment.id)
        }
      })
      // Remember this combination so "Try Another" moves on to a new one.
      excludeRef.current = [...excludeRef.current, ...appliedIds]
      setResult(recommended)
      onOutfitGenerated?.(vibe, appliedIds)
    } catch (err) {
      // Safe failure surface: never leave an unhandled rejection, and
      // surface a user-friendly message when nothing could be built.
      console.warn('[FITIQ] outfit recommendation failed', err)
      if (run === buildRun.current) setError(messageForError(err))
    } finally {
      if (run === buildRun.current) setWorking(false)
    }
  }

  return (
    <section className="surface rounded-2xl p-6" aria-label="AI outfit selector">
      <div className="flex items-center gap-2">
        <Icon name="sparkle" size={15} className="text-beige-deep" />
        <p className="overline">AI Outfit Selector</p>
      </div>

      <h2 className="mt-3 font-display text-2xl">What’s the vibe?</h2>

      <div className={`mt-5 flex flex-wrap gap-2 transition-opacity duration-200 ${working ? 'pointer-events-none opacity-60' : ''}`}>
        {VIBE_ORDER.map((v) => (
          <Tag
            key={v}
            active={vibe === v}
            onClick={() => {
              setVibe(v)
              setResult(null)
              setError(null)
              excludeRef.current = []
            }}
          >
            {VIBES[v].label}
          </Tag>
        ))}
      </div>

      {vibe && (
        <p className="mt-3 text-sm italic text-ink-soft">
          {VIBES[vibe].blurb}
        </p>
      )}

      <div className="mt-5">
        <Button
          size="lg"
          fullWidth
          disabled={!vibe || working}
          loading={working}
          onClick={build}
        >
          <Icon name="sparkle" size={16} />
          {working ? 'Curating your look…' : 'Build My Fit'}
        </Button>
      </div>

      {error && !working && (
        <div className="mt-5 border-t border-line pt-4" aria-live="polite">
          <div className="flex items-start gap-2.5">
            <Icon name="x" size={16} className="mt-0.5 shrink-0 text-clay" />
            <p className="text-sm leading-relaxed text-ink-soft">{error}</p>
          </div>
        </div>
      )}

      {result && !working && (
        <div className="mt-5 border-t border-line pt-4" aria-live="polite">
          <div className="flex items-start gap-2.5">
            <Icon name="check" size={16} className="mt-0.5 shrink-0 text-forest" />
            <p className="font-display text-[0.9375rem] italic leading-relaxed text-ink-soft">
              {result.rationale}
            </p>
          </div>
          <div className="mt-4 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              disabled={working}
              onClick={build}
              aria-label="Try another outfit combination"
            >
              <Icon name="sparkle" size={14} />
              Try Another
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}
