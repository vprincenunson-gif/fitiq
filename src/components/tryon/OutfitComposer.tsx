import { useState } from 'react'
import type { OutfitComposition, OutfitSlotKey } from '../../lib/types'
import { wearStatLabel } from '../../lib/wear'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'
import { Dialog } from '../ui/Dialog'

interface OutfitComposerProps {
  outfit: OutfitComposition
  savedOutfits: { id: string; name: string }[]
  onRemove: (slotKey: OutfitSlotKey) => void
  onClear: () => void
  onSave: (name: string) => void
  onLoad: (id: string) => void
  /** Wear summary for a saved look, shown under its name. */
  wornSummary?: (id: string) => { wearCount: number; lastWornAt: string | null }
  /** Opens the confirmation step for marking a saved look as worn. */
  onMarkWorn?: (id: string) => void
}

const ROWS: { key: OutfitSlotKey; label: string }[] = [
  { key: 'shirt', label: 'Top' },
  { key: 'pants', label: 'Bottom' },
  { key: 'shoes', label: 'Shoes' },
]

const KEY_TO_SLOT = { shirt: 'top', pants: 'bottom', shoes: 'shoes' } as const

export function OutfitComposer({
  outfit,
  savedOutfits,
  onRemove,
  onClear,
  onSave,
  onLoad,
  wornSummary,
  onMarkWorn,
}: OutfitComposerProps) {
  const [saveOpen, setSaveOpen] = useState(false)
  const [name, setName] = useState('')
  const filled = ROWS.filter((row) => outfit[KEY_TO_SLOT[row.key]]).length

  return (
    <div className="surface rounded-2xl p-6">
      <div className="flex items-baseline justify-between">
        <div className="flex items-baseline gap-3">
          <h2 className="font-display text-lg">Outfit</h2>
          <span className="overline">{filled} of 3</span>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="text-xs font-medium uppercase tracking-wider text-ink-faint transition-colors hover:text-ink"
        >
          Clear
        </button>
      </div>

      <ul className="mt-5 space-y-3">
        {ROWS.map((row) => {
          const garment = outfit[KEY_TO_SLOT[row.key]]
          return (
            <li
              key={row.key}
              className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5"
            >
              {garment ? (
                <img src={garment.image} alt="" className="h-10 w-10 rounded-lg object-contain bg-cream/50 p-1" />
              ) : (
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-cream/50 text-ink-faint">
                  <Icon name="plus" size={16} />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="overline">{row.label}</p>
                <p className="truncate text-sm font-medium text-ink">
                  {garment ? garment.name : 'Pick from the tray'}
                </p>
              </div>
              {garment && (
                <button
                  type="button"
                  onClick={() => onRemove(row.key)}
                  aria-label={`Remove ${row.label}`}
                  className="text-ink-faint transition-colors hover:text-ink"
                >
                  <Icon name="x" size={16} />
                </button>
              )}
            </li>
          )
        })}
      </ul>

      <Button
        className="mt-5 w-full"
        disabled={filled === 0}
        onClick={() => setSaveOpen(true)}
      >
        <Icon name="check" size={16} />
        {filled === 3 ? 'Save this look' : 'Save outfit'}
      </Button>

      {savedOutfits.length > 0 && (
        <div className="mt-6 border-t border-line pt-5">
          <p className="overline mb-3">Saved</p>
          <ul className="space-y-2">
            {savedOutfits.slice(0, 5).map((outfit) => {
              const wear = wornSummary?.(outfit.id)
              return (
                <li key={outfit.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onLoad(outfit.id)}
                    className="group flex min-w-0 flex-1 items-center justify-between text-left text-sm text-ink-soft transition-colors hover:text-ink"
                  >
                    <span className="min-w-0">
                      <span className="block truncate">{outfit.name}</span>
                      {wear && wear.wearCount > 0 && (
                        <span className="mt-0.5 block truncate text-[0.625rem] font-normal uppercase tracking-wider text-ink-faint">
                          {wearStatLabel(wear)}
                        </span>
                      )}
                    </span>
                    <Icon name="chevron-right" size={14} className="opacity-0 transition-opacity group-hover:opacity-100" />
                  </button>
                  {onMarkWorn && (
                    <button
                      type="button"
                      onClick={() => onMarkWorn(outfit.id)}
                      aria-label={`Mark ${outfit.name} as worn`}
                      title="Mark as worn"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line text-ink-faint transition-colors hover:border-ink/30 hover:text-ink"
                    >
                      <Icon name="check" size={14} />
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <Dialog open={saveOpen} title="Save outfit" onClose={() => setSaveOpen(false)}>
        <label className="block">
          <span className="overline mb-2 block">Outfit name</span>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && name.trim()) {
                onSave(name.trim())
                setSaveOpen(false)
                setName('')
              }
            }}
            placeholder="e.g. Friday office"
            className="w-full border-b border-line bg-transparent py-2 text-sm text-ink outline-none focus:border-beige-deep"
          />
        </label>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setSaveOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={!name.trim()}
            onClick={() => {
              onSave(name.trim())
              setSaveOpen(false)
              setName('')
            }}
          >
            Save
          </Button>
        </div>
      </Dialog>
    </div>
  )
}
