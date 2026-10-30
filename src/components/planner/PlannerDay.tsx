import type { Piece } from '../../lib/pieces'
import type { Outfit } from '../../lib/types'
import { VIBES, VIBE_ORDER, type Vibe } from '../../services/recommend'
import type { PlannedDay } from '../../stores/PlannerContext'
import { Icon } from '../ui/Icon'

interface PlannerDayProps {
  date: Date
  isToday: boolean
  isWeekend: boolean
  entry: PlannedDay | undefined
  outfit: Outfit | undefined
  /** The saved outfit's pieces resolved against the wardrobe, in [top, bottom, shoes] order. */
  pieces: Piece[]
  /** The same saved outfit is planned again within the visible week. */
  duplicated: boolean
  /** This day's look has already been confirmed as worn. */
  worn: boolean
  /** Today or earlier — future plans can't be worn yet. */
  canMarkWorn: boolean
  onAssign: () => void
  onClear: () => void
  onOccasion: (occasion: Vibe | null) => void
  onMarkWorn: () => void
}

const WEEKDAY = new Intl.DateTimeFormat('en-US', { weekday: 'short' })
const WEEKDAY_LONG = new Intl.DateTimeFormat('en-US', { weekday: 'long' })
const DAY_NUMBER = new Intl.DateTimeFormat('en-US', { day: 'numeric' })
const MONTH = new Intl.DateTimeFormat('en-US', { month: 'short' })

/**
 * One day on the planner grid: date, occasion and — when assigned — the
 * saved outfit's three pieces shown from their stored original photos.
 */
export function PlannerDay({
  date,
  isToday,
  isWeekend,
  entry,
  outfit,
  pieces,
  duplicated,
  worn,
  canMarkWorn,
  onAssign,
  onClear,
  onOccasion,
  onMarkWorn,
}: PlannerDayProps) {
  const weekday = WEEKDAY.format(date)
  const weekdayLong = WEEKDAY_LONG.format(date)
  const assigned = entry?.outfitId != null
  const broken = assigned && !outfit

  return (
    <div
      className={[
        'surface relative flex h-full flex-col rounded-2xl p-4',
        isToday ? 'border-beige-deep/60' : '',
        isWeekend && !isToday ? 'bg-cream/20' : '',
      ].join(' ')}
      aria-label={`${WEEKDAY_LONG.format(date)} ${DAY_NUMBER.format(date)} ${MONTH.format(date)}`}
    >
      {/* Date header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="overline">
            {weekday}
            {isToday ? ' · today' : ''}
          </p>
          <p
            className={[
              'mt-0.5 font-display text-xl leading-none',
              isToday ? 'text-beige-deep' : 'text-ink',
            ].join(' ')}
          >
            {DAY_NUMBER.format(date)}
          </p>
          <p className="mt-0.5 text-[0.625rem] uppercase tracking-wider text-ink-faint">{MONTH.format(date)}</p>
        </div>
        {assigned && (
          <button
            type="button"
            onClick={onClear}
            aria-label={`Clear plan for ${WEEKDAY_LONG.format(date)} ${DAY_NUMBER.format(date)}`}
            className="text-ink-faint transition-colors hover:text-ink"
          >
            <Icon name="x" size={14} />
          </button>
        )}
      </div>

      {/* Assigned look — the saved outfit's original photos */}
      <div className="mt-3 flex-1">
        {broken ? (
          <p className="text-xs leading-relaxed text-clay">
            Saved look was removed — plan another outfit.
          </p>
        ) : assigned && outfit ? (
          <button
            type="button"
            onClick={onAssign}
            aria-label={`Change the outfit planned for ${weekdayLong} ${DAY_NUMBER.format(date)}`}
            className="group block w-full text-left"
          >
            <div className="flex items-center gap-2">
              {pieces.slice(0, 3).map((piece, i) => (
                <img
                  key={i}
                  src={piece.image}
                  alt={piece.name}
                  title={`${piece.categoryLabel}: ${piece.name}`}
                  className="img-shell h-9 w-9 rounded-lg bg-cream/50 object-contain p-0.5 transition-transform duration-200 ease-editorial group-hover:scale-[1.06]"
                />
              ))}
              {pieces.length === 0 && (
                <span className="text-[0.6875rem] text-ink-faint">pieces were removed</span>
              )}
            </div>
            <p className="mt-2 truncate font-display text-[0.9375rem] leading-snug text-ink transition-colors group-hover:text-beige-deep">
              {outfit.name}
            </p>
          </button>
        ) : (
          <button
            type="button"
            onClick={onAssign}
            aria-label={`Plan an outfit for ${weekdayLong} ${DAY_NUMBER.format(date)}`}
            className="flex h-[4.5rem] w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-line text-ink-faint transition-colors hover:border-beige-deep/50 hover:bg-cream/30 hover:text-ink"
          >
            <Icon name="plus" size={16} />
            <span className="text-[0.6875rem] font-medium uppercase tracking-wider">Plan outfit</span>
          </button>
        )}

        {assigned && duplicated && !broken && (
          <p className="mt-2 inline-flex items-center gap-1 rounded-full border border-clay/30 bg-cream/40 px-2 py-0.5 text-[0.625rem] font-medium uppercase tracking-wider text-clay">
            <Icon name="check" size={10} />
            Worn again this week
          </p>
        )}
      </div>

      {/* Occasion */}
      <label className="mt-3 block">
        <span className="sr-only">Occasion for {weekdayLong} {DAY_NUMBER.format(date)}</span>
        <select
          value={entry?.occasion ?? ''}
          onChange={(e) => {
            const raw = e.target.value
            onOccasion(raw === '' ? null : (raw as Vibe))
          }}
          className="w-full cursor-pointer border-b border-line bg-transparent py-1.5 text-[0.6875rem] text-ink-soft outline-none transition-colors focus:border-beige-deep"
        >
          <option value="">No occasion</option>
          {VIBE_ORDER.map((vibe) => (
            <option key={vibe} value={vibe}>
              {VIBES[vibe].label}
            </option>
          ))}
        </select>
      </label>

      {/* Confirmed wear — logged only after the confirmation dialog */}
      {assigned && !broken &&
        (worn ? (
          <p className="mt-3 inline-flex items-center gap-1 self-start rounded-full border border-forest/30 bg-cream/40 px-2 py-0.5 text-[0.625rem] font-medium uppercase tracking-wider text-forest">
            <Icon name="check" size={10} />
            Worn
          </p>
        ) : canMarkWorn ? (
          <button
            type="button"
            onClick={onMarkWorn}
            className="mt-3 inline-flex items-center gap-1 self-start text-[0.625rem] font-medium uppercase tracking-wider text-ink-faint transition-colors hover:text-ink"
          >
            <Icon name="check" size={11} />
            Mark as worn
          </button>
        ) : null)}
    </div>
  )
}
