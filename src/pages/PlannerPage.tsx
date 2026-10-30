import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useWardrobe } from '../stores/WardrobeContext'
import { useOutfit } from '../stores/OutfitContext'
import { useWear } from '../stores/WearContext'
import {
  isSameLocalDay,
  localDateKey,
  usePlanner,
  weekDates,
  formatWeekRange,
} from '../stores/PlannerContext'
import { PlannerDay } from '../components/planner/PlannerDay'
import { AssignOutfitDialog } from '../components/planner/AssignOutfitDialog'
import { MarkWornDialog } from '../components/wear/MarkWornDialog'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { Icon } from '../components/ui/Icon'
import { Overline } from '../components/ui/Overline'
import { Spinner } from '../components/ui/Spinner'
import type { Outfit } from '../lib/types'
import { resolveOutfitPieces } from '../lib/pieces'
import { wearTimestampForDay } from '../lib/wear'

function PlannerInner() {
  const { garments, ready } = useWardrobe()
  const { savedOutfits } = useOutfit()
  const { plan, assignOutfit, setOccasion, clearDay } = usePlanner()
  const { markWorn, wornEntryFor } = useWear()

  const [weekOffset, setWeekOffset] = useState(0)
  const [assigning, setAssigning] = useState<string | null>(null)
  const [markingWorn, setMarkingWorn] = useState<string | null>(null)

  const days = useMemo(() => weekDates(weekOffset), [weekOffset])
  const dayKeys = days.map(localDateKey)

  const byId = useMemo(() => new Map(garments.map((g) => [g.id, g])), [garments])
  const outfitById = useMemo(() => new Map(savedOutfits.map((o) => [o.id, o])), [savedOutfits])

  // Highlight day captured at mount — pure per render, stable during a visit.
  const [today] = useState(() => new Date())
  const todayKey = localDateKey(today)

  /** Saved looks assigned more than once within the visible week. */
  const repeatedOutfitIds = useMemo(() => {
    const counts = new Map<string, number>()
    for (const key of dayKeys) {
      const outfitId = plan[key]?.outfitId
      if (outfitId && outfitById.has(outfitId)) {
        counts.set(outfitId, (counts.get(outfitId) ?? 0) + 1)
      }
    }
    return counts
  }, [plan, dayKeys, outfitById])

  /** The date key currently being planned. */
  const dateKeyBeingPlanned = assigning

  /** "Tue, Oct 28" — the first other visible-week day an outfit is already planned on. */
  const plannedElsewhereLabel = (outfit: Outfit): string | null => {
    const weekdayFmt = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    for (const [index, key] of dayKeys.entries()) {
      const planned = plan[key]?.outfitId === outfit.id
      const later = dateKeyBeingPlanned !== key
      if (planned && later) return weekdayFmt.format(days[index])
    }
    return null
  }

  if (!ready) {
    return (
      <div className="surface flex items-center justify-center rounded-2xl py-24" aria-label="Loading your wardrobe">
        <Spinner size={26} />
      </div>
    )
  }

  if (garments.length === 0) {
    return (
      <EmptyState
        icon="hanger"
        headline="Nothing to plan yet"
        copy="Scan your first item — your fits become plan-ready once they're in the wardrobe."
        action={
          <Link to="/scan">
            <Button>
              <Icon name="camera" size={16} />
              Scan an item
            </Button>
          </Link>
        }
      />
    )
  }

  if (savedOutfits.length === 0) {
    return (
      <EmptyState
        icon="sparkle"
        headline="No saved looks to plan"
        copy="Compose outfits with the AI selector, save them, then spread them across the week here."
        action={
          <Link to="/try-on">
            <Button>
              <Icon name="arrow-right" size={16} />
              Compose a look
            </Button>
          </Link>
        }
      />
    )
  }

  const plannedCount = dayKeys.filter((key) => plan[key]?.outfitId != null).length
  const repeatedCount = [...repeatedOutfitIds.values()].filter((n) => n > 1).length
  const assigningDate = assigning ? days[dayKeys.indexOf(assigning)] ?? null : null
  const markingEntry = markingWorn ? plan[markingWorn] : undefined
  const markingOutfit = markingEntry?.outfitId ? outfitById.get(markingEntry.outfitId) : undefined
  const markingDate = markingWorn ? days[dayKeys.indexOf(markingWorn)] ?? null : null

  return (
    <div>
      <div className="mb-8">
        <Overline>Outfit Planner</Overline>
        <h1 className="mt-2 font-display text-3xl md:text-4xl">Plan the week.</h1>
      </div>

      {/* Week navigation + summary */}
      <div className="surface mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl px-5 py-3.5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setWeekOffset((w) => w - 1)}
            aria-label="Previous week"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-ink-soft transition-colors hover:border-ink/30 hover:text-ink"
          >
            <Icon name="chevron-left" size={15} />
          </button>
          <button
            type="button"
            onClick={() => setWeekOffset((w) => w + 1)}
            aria-label="Next week"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-ink-soft transition-colors hover:border-ink/30 hover:text-ink"
          >
            <Icon name="chevron-right" size={15} />
          </button>
          <p className="font-display text-lg">{formatWeekRange(days)}</p>
          {weekOffset !== 0 && (
            <Button size="sm" variant="ghost" onClick={() => setWeekOffset(0)}>
              This week
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs text-ink-soft">
          <span className="overline !tracking-[0.18em]">
            {plannedCount} of 7 days planned
          </span>
          {repeatedCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full border border-clay/30 bg-cream/40 px-2.5 py-0.5 text-[0.6875rem] font-medium text-clay">
              <Icon name="check" size={11} />
              {repeatedCount === 1 ? 'One look worn twice' : `${repeatedCount} looks worn more than once`}
            </span>
          )}
        </div>
      </div>

      {/* 7-day grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {days.map((date, index) => {
          const key = dayKeys[index]
          const entry = plan[key] // eslint-disable-line @typescript-eslint/no-unnecessary-condition -- dynamic keys
          const outfit = entry?.outfitId ? outfitById.get(entry.outfitId) : undefined
          const duplicates = entry?.outfitId != null && (repeatedOutfitIds.get(entry.outfitId) ?? 0) > 1
          return (
            <PlannerDay
              key={key}
              date={date}
              isToday={isSameLocalDay(date, today)}
              isWeekend={index >= 5}
              entry={entry}
              outfit={outfit}
              pieces={outfit ? resolveOutfitPieces(outfit.garmentIds, byId) : []}
              duplicated={duplicates}
              worn={outfit ? wornEntryFor(key, outfit.id) != null : false}
              canMarkWorn={key <= todayKey}
              onAssign={() => setAssigning(key)}
              onClear={() => clearDay(key)}
              onOccasion={(occasion) => setOccasion(key, occasion)}
              onMarkWorn={() => setMarkingWorn(key)}
            />
          )
        })}
      </div>

      <p className="mt-6 text-center text-[0.6875rem] uppercase tracking-[0.18em] text-ink-faint">
        Plans save on this device and sync privately when you sign in — saved looks are reused, never re-analysed.
      </p>

      <AssignOutfitDialog
        key={assigning ?? 'closed'}
        open={assigning != null}
        date={assigningDate}
        savedOutfits={savedOutfits}
        piecesOf={(outfit) => resolveOutfitPieces(outfit.garmentIds, byId)}
        plannedElsewhereFor={plannedElsewhereLabel}
        onSave={(outfitId) => assigning && assignOutfit(assigning, outfitId)}
        onClose={() => setAssigning(null)}
      />

      <MarkWornDialog
        open={markingOutfit != null}
        outfitName={markingOutfit?.name ?? ''}
        pieces={markingOutfit ? resolveOutfitPieces(markingOutfit.garmentIds, byId) : []}
        date={markingDate}
        onConfirm={() => {
          if (markingWorn && markingOutfit) {
            markWorn({
              dateKey: markingWorn,
              garmentIds: markingOutfit.garmentIds,
              outfitId: markingOutfit.id,
              source: 'planner',
              wornAt: markingDate ? wearTimestampForDay(markingDate) : undefined,
            })
          }
          setMarkingWorn(null)
        }}
        onClose={() => setMarkingWorn(null)}
      />
    </div>
  )
}

export function PlannerPage() {
  return <PlannerInner />
}
