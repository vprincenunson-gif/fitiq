import type { Piece } from '../../lib/pieces'
import { Button } from '../ui/Button'
import { Dialog } from '../ui/Dialog'
import { Icon } from '../ui/Icon'

interface MarkWornDialogProps {
  open: boolean
  /** Saved outfit or planned look name. */
  outfitName: string
  pieces: Piece[]
  /** Day the look was worn; null when marking a saved look for today. */
  date: Date | null
  onConfirm: () => void
  onClose: () => void
}

const DAY_FORMAT = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'short',
  day: 'numeric',
})

/**
 * Confirmation step before any wear is recorded. Wear Status and per-garment
 * stats only change after the user accepts here.
 */
export function MarkWornDialog({
  open,
  outfitName,
  pieces,
  date,
  onConfirm,
  onClose,
}: MarkWornDialogProps) {
  if (!open) return null

  return (
    <Dialog open={open} title="Mark as worn?" onClose={onClose}>
      <div className="flex items-center gap-2">
        {pieces.slice(0, 3).map((piece, i) => (
          <img
            key={i}
            src={piece.image}
            alt={piece.name}
            title={`${piece.categoryLabel}: ${piece.name}`}
            className="img-shell h-11 w-11 rounded-lg bg-cream/50 object-contain p-0.5"
          />
        ))}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{outfitName}</p>
          {date && (
            <p className="mt-0.5 text-[0.6875rem] uppercase tracking-wider text-ink-faint">
              {DAY_FORMAT.format(date)}
            </p>
          )}
        </div>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-ink-soft">
        Each piece gets one more wear and is set to <em>Worn</em> in your wardrobe. You can switch
        any item back to <em>Ready</em> at any time.
      </p>

      <div className="mt-6 flex justify-end gap-3">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={onConfirm}>
          <Icon name="check" size={16} />
          Mark as worn
        </Button>
      </div>
    </Dialog>
  )
}
