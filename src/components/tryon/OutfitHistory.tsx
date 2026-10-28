import type { Garment } from '../../lib/types'
import { VIBES } from '../../services/recommend'
import type { HistoryEntry } from '../../stores/OutfitHistoryContext'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'

interface OutfitHistoryProps {
  entries: HistoryEntry[]
  garments: Garment[]
  onRestore: (entry: HistoryEntry) => void
  onRemove: (id: string) => void
}

const TIME_FORMATTER = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

function Thumb({ garmentId, garments }: { garmentId: string; garments: Garment[] }) {
  const garment = garments.find((g) => g.id === garmentId)
  return (
    <span className="flex h-14 w-12 items-center justify-center overflow-hidden rounded-xl border border-line bg-cream/50">
      {garment ? (
        <img src={garment.image} alt={garment.name} className="max-h-full max-w-full object-contain p-1" />
      ) : (
        <Icon name="hanger" size={16} className="text-ink-faint" />
      )}
    </span>
  )
}

export function OutfitHistory({ entries, garments, onRestore, onRemove }: OutfitHistoryProps) {
  if (entries.length === 0) return null

  return (
    <section className="surface rounded-2xl" aria-label="Outfit history">
      <div className="flex items-baseline justify-between border-b border-line px-6 py-5">
        <div>
          <p className="overline">Outfit History</p>
          <h2 className="mt-1 font-display text-xl">Looks you've explored.</h2>
        </div>
      </div>

      <ul className="divide-y divide-line">
        {entries.slice(0, 8).map((entry) => (
          <li key={entry.id} className="flex items-center gap-4 px-6 py-4">
            <div className="flex shrink-0 items-center gap-1.5">
              {entry.garmentIds.slice(0, 3).map((id, i) => (
                <Thumb key={`${entry.id}-${id}-${i}`} garmentId={id} garments={garments} />
              ))}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">{VIBES[entry.vibe]?.label ?? 'Look'}</p>
              <p className="mt-0.5 text-xs text-ink-faint">
                {TIME_FORMATTER.format(new Date(entry.createdAt))}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onRestore(entry)}>
              Wear this
            </Button>
            <button
              type="button"
              onClick={() => onRemove(entry.id)}
              aria-label="Remove from history"
              className="text-ink-faint transition-colors hover:text-ink"
            >
              <Icon name="x" size={15} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
