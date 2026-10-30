import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { OutfitComposition } from '../lib/types'
import { useOutfit } from '../stores/OutfitContext'
import { useWardrobe } from '../stores/WardrobeContext'
import { OutfitShowcase } from '../components/tryon/OutfitShowcase'
import { ItemTray } from '../components/tryon/ItemTray'
import { OutfitComposer } from '../components/tryon/OutfitComposer'
import { VibeSelector } from '../components/tryon/VibeSelector'
import { OutfitHistory } from '../components/tryon/OutfitHistory'
import { WeatherCard } from '../components/tryon/WeatherCard'
import { StyleProfileDialog } from '../components/tryon/StyleProfileDialog'
import { Button } from '../components/ui/Button'
import { Spinner } from '../components/ui/Spinner'
import { useStyleProfile } from '../stores/StyleProfileContext'
import { Icon } from '../components/ui/Icon'
import { EmptyState } from '../components/ui/EmptyState'
import { Overline } from '../components/ui/Overline'
import { tryOnService } from '../services'
import { VIBES, type Vibe } from '../services/recommend'
import type { WeatherInfo } from '../services/weather'
import { useOutfitHistory } from '../stores/OutfitHistoryContext'
import { useWear } from '../stores/WearContext'
import { MarkWornDialog } from '../components/wear/MarkWornDialog'
import { resolveOutfitPieces } from '../lib/pieces'
import { wearDayKey } from '../lib/wear'

export function TryOnPage() {
  const { currentOutfit, savedOutfits, addToOutfit, removeFromOutfit, clearOutfit, saveOutfit, loadOutfit } =
    useOutfit()
  const { garments, ready } = useWardrobe()
  const { history, record, remove } = useOutfitHistory()
  const { profile, updateProfile, resetProfile } = useStyleProfile()
  const { markWorn, outfitWear } = useWear()
  const [styleOpen, setStyleOpen] = useState(false)
  const [composing, setComposing] = useState(false)
  const [weather, setWeather] = useState<WeatherInfo | null>(null)
  const [markingWorn, setMarkingWorn] = useState<{ id: string; date: Date } | null>(null)

  const garmentMap = useMemo(() => new Map(garments.map((g) => [g.id, g])), [garments])
  const markingWornOutfit = markingWorn ? savedOutfits.find((o) => o.id === markingWorn.id) : undefined

  /** AI-generated look → history (ids only; images stay local). */
  const handleOutfitGenerated = (vibe: Vibe, ids: string[]) => {
    record(vibe, ids)
  }

  const handleRestore = (entry: (typeof history)[number]) => {
    loadOutfit({
      id: entry.id,
      name: `${VIBES[entry.vibe]?.label ?? 'Look'} look`,
      garmentIds: entry.garmentIds,
      createdAt: entry.createdAt,
    })
  }

  const activeIds = useMemo(
    () =>
      new Set(
        [currentOutfit.top, currentOutfit.bottom, currentOutfit.shoes]
          .filter(Boolean)
          .map((g) => g!.id),
      ),
    [currentOutfit],
  )

  /** Recommendation service resolves garment ids → garments, then applies them. */
  const handleRecommend = ({ id }: { id: string }) => {
    const garment = garments.find((g) => g.id === id)
    if (garment) handleSelect(garment)
  }

  const handleSelect = (garment: (typeof garments)[number]) => {
    setComposing(true)
    // Compose the *next* outfit — state hasn't updated yet, so apply the
    // selection locally so the newly picked item is included.
    const slot = garment.category === 'shirt' ? 'top' : garment.category === 'pants' ? 'bottom' : 'shoes'
    const nextOutfit: OutfitComposition = { ...currentOutfit, [slot]: garment }
    void tryOnService.compose(nextOutfit).then(() => {
      // brief fade to suggest composition
      window.setTimeout(() => setComposing(false), 260)
    })
    addToOutfit({ id: garment.id, category: garment.category })
  }

  const hasItems = garments.length > 0

  return (
    <div>
      <div className="mb-8">
        <Overline>Your Fit</Overline>
        <h1 className="mt-2 font-display text-3xl md:text-4xl">Compose your outfit.</h1>
      </div>

      {!ready ? (
        <div className="surface flex items-center justify-center rounded-2xl py-24" aria-label="Loading your wardrobe">
          <Spinner size={26} />
        </div>
      ) : !hasItems ? (
        <EmptyState
          icon="hanger"
          headline="Your wardrobe is empty"
          copy="Scan an item first, then come back to build outfits."
          action={
            <Link to="/scan">
              <Button>
                <Icon name="camera" size={16} />
                Scan an item
              </Button>
            </Link>
          }
        />
      ) : (
        <>
        <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
          <OutfitShowcase outfit={currentOutfit} composing={composing} />

          <div className="space-y-8">
            {/* "My Style" — minimal entry point, no settings dashboard */}
            <div className="surface flex items-center justify-between gap-4 rounded-2xl px-5 py-3.5">
              <div className="min-w-0">
                <p className="overline">My Style</p>
                <p className="mt-1 truncate text-xs text-ink-soft">
                  {profile.fit || profile.favoriteColors.length > 0 || profile.likes.length > 0 || profile.avoids.length > 0
                    ? [
                        profile.fit ? profile.fit.charAt(0).toUpperCase() + profile.fit.slice(1) : '',
                        profile.favoriteColors.length > 0 ? `${profile.favoriteColors.length} color${profile.favoriteColors.length > 1 ? 's' : ''}` : '',
                        profile.likes.length > 0 ? `likes ${profile.likes.join(', ')}` : '',
                        profile.avoids.length > 0 ? `avoids ${profile.avoids.join(', ')}` : '',
                      ]
                        .filter(Boolean)
                        .join(' · ')
                    : 'No preferences set yet'}
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setStyleOpen(true)}>
                Edit
              </Button>
            </div>

            <WeatherCard weather={weather} onWeather={setWeather} />
            <VibeSelector
              wardrobe={garments}
              current={currentOutfit}
              onAdd={handleRecommend}
              onOutfitGenerated={handleOutfitGenerated}
              weather={weather}
              profile={profile}
            />
            <OutfitComposer
              outfit={currentOutfit}
              savedOutfits={savedOutfits.map((o) => ({ id: o.id, name: o.name }))}
              onRemove={removeFromOutfit}
              onClear={clearOutfit}
              onSave={saveOutfit}
              onLoad={(id) => {
                const outfit = savedOutfits.find((o) => o.id === id)
                if (outfit) loadOutfit(outfit)
              }}
              wornSummary={outfitWear}
              onMarkWorn={(id) => setMarkingWorn({ id, date: new Date() })}
            />
            <ItemTray garments={garments} activeIds={activeIds} onSelect={handleSelect} />
          </div>
        </div>

        <div className="mt-8">
          <OutfitHistory
            entries={history}
            garments={garments}
            onRestore={handleRestore}
            onRemove={remove}
          />
        </div>
        </>
      )}

      <StyleProfileDialog
        open={styleOpen}
        profile={profile}
        onClose={() => setStyleOpen(false)}
        onSave={updateProfile}
        onReset={() => {
          resetProfile()
          setStyleOpen(false)
        }}
      />

      <MarkWornDialog
        open={markingWornOutfit != null}
        outfitName={markingWornOutfit?.name ?? ''}
        pieces={markingWornOutfit ? resolveOutfitPieces(markingWornOutfit.garmentIds, garmentMap) : []}
        date={markingWorn?.date ?? null}
        onConfirm={() => {
          if (markingWornOutfit && markingWorn) {
            markWorn({
              dateKey: wearDayKey(markingWorn.date),
              garmentIds: markingWornOutfit.garmentIds,
              outfitId: markingWornOutfit.id,
              source: 'saved',
            })
          }
          setMarkingWorn(null)
        }}
        onClose={() => setMarkingWorn(null)}
      />
    </div>
  )
}
