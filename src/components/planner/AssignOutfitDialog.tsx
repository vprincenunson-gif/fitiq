import { useState } from 'react'
import type { Outfit } from '../../lib/types'
import { Dialog } from '../ui/Dialog'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'
import type { Piece } from './PlannerDay'

interface AssignOutfitDialogProps {
  open: boolean
  /** The day being planned (rendered in the title). */
  date: Date | null
  savedOutfits: Outfit[]
  /** Resolve a saved outfit's pieces to wardrobe images, in [top, bottom, shoes] order. */
  piecesOf: (outfit: Outfit) => Piece[]
  /** First other visible-week day this outfit is already planned on, for the reuse warning. */
  plannedElsewhereFor: (outfit: Outfit) => string | null
  onSave: (outfitId: string) => void
  onClose: () => void
}

/**
 * Pick one of the already-saved looks for a planner day. Shows each look's
 * pieces as their stored original photos, plus a gentle warning when the
 * chosen look is already worn on another day of the visible week.
 */
export function AssignOutfitDialog({
  open,
  date,
  savedOutfits,
  piecesOf,
  plannedElsewhereFor,
  onSave,
  onClose,
}: AssignOutfitDialogProps) {
  // `selected` resets naturally: the parent remounts this component per open
  // (keyed by the planned day), so no reset effect is needed.
  const [selected, setSelected] = useState<string | null>(null)

  if (!open || !date) return null

  const dayLabel = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).format(date)

  const handleSave = () => {
    if (!selected) return
    onSave(selected)
    onClose()
  }

  return (
    <Dialog open={open} title={`Plan ${dayLabel}`} onClose={onClose}>
      {savedOutfits.length === 0 ? (
        <p className="text-sm text-ink-soft">
          No saved looks yet — compose an outfit on <em> Your Fit</em> and save it first.
        </p>
      ) : (
        <>
          <ul className="-mr-1 max-h-72 space-y-2.5 overflow-y-auto pr-1" role="radiogroup" aria-label="Saved outfits">
            {savedOutfits.map((outfit) => {
              const active = selected === outfit.id
              const reuseOn = plannedElsewhereFor(outfit)
              return (
                <li key={outfit.id}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setSelected(outfit.id)}
                    className={[
                      'flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors duration-200 ease-editorial',
                      active
                        ? 'border-beige-deep bg-cream/40'
                        : 'border-line hover:border-line-strong hover:bg-cream/20',
                    ].join(' ')}
                  >
                    <span className="flex shrink-0 items-center gap-1">
                      {piecesOf(outfit).slice(0, 3).map((piece, i) => (
                        <img
                          key={i}
                          src={piece.image}
                          alt={piece.name}
                          className="img-shell h-9 w-9 rounded-lg bg-cream/50 object-contain p-0.5"
                        />
                      ))}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">{outfit.name}</span>
                      {reuseOn && (
                        <span className="mt-0.5 flex items-center gap-1 text-[0.6875rem] text-clay">
                          <Icon name="check" size={10} />
                          Already planned for {reuseOn}
                        </span>
                      )}
                    </span>
                    <span
                      className={[
                        'flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full border transition-colors',
                        active ? 'border-ink bg-ink text-paper' : 'border-line-strong',
                      ].join(' ')}
                      aria-hidden="true"
                    >
                      {active && <Icon name="check" size={10} />}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>

          <div className="mt-6 flex justify-end gap-3">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={!selected} onClick={handleSave}>
              <Icon name="check" size={16} />
              Plan look
            </Button>
          </div>
        </>
      )}
    </Dialog>
  )
}
