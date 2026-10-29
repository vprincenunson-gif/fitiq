import { useState } from 'react'
import type { GarmentColor, GarmentFit, StyleProfile, StyleTaste } from '../../lib/types'
import { STYLE_TASTES } from '../../lib/types'
import { Button } from '../ui/Button'
import { Dialog } from '../ui/Dialog'
import { Tag } from '../ui/Tag'

interface StyleProfileDialogProps {
  open: boolean
  profile: StyleProfile
  onClose: () => void
  onSave: (profile: StyleProfile) => void
  onReset: () => void
}

const FIT_OPTIONS: GarmentFit[] = ['slim', 'regular', 'relaxed']

const COLOR_OPTIONS: GarmentColor[] = [
  'white', 'black', 'oat', 'beige', 'charcoal', 'navy', 'blue',
  'olive', 'clay', 'sand', 'tan', 'denim',
]

const TASTE_LABELS: Record<StyleTaste, string> = {
  minimal: 'Minimal',
  casual: 'Casual',
  formal: 'Formal',
  street: 'Street',
  sporty: 'Sporty',
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value]
}

export function StyleProfileDialog({ open, profile, onClose, onSave, onReset }: StyleProfileDialogProps) {
  const [draft, setDraft] = useState<StyleProfile>(profile)

  // Re-seed the draft each time the dialog opens with a fresh profile.
  const [lastOpen, setLastOpen] = useState(open)
  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) setDraft(profile)
  }

  return (
    <Dialog open={open} title="My Style" onClose={onClose}>
      <div className="space-y-6">
        <div>
          <p className="overline mb-3">Preferred fit</p>
          <div className="flex flex-wrap gap-2">
            {FIT_OPTIONS.map((fit) => (
              <Tag
                key={fit}
                active={draft.fit === fit}
                onClick={() => setDraft({ ...draft, fit: draft.fit === fit ? null : fit })}
              >
                {fit.charAt(0).toUpperCase() + fit.slice(1)}
              </Tag>
            ))}
          </div>
        </div>

        <div>
          <p className="overline mb-3">Favorite colors</p>
          <div className="flex flex-wrap gap-2">
            {COLOR_OPTIONS.map((color) => (
              <Tag
                key={color}
                active={draft.favoriteColors.includes(color)}
                onClick={() =>
                  setDraft({ ...draft, favoriteColors: toggle(draft.favoriteColors, color) })
                }
              >
                {color.charAt(0).toUpperCase() + color.slice(1)}
              </Tag>
            ))}
          </div>
        </div>

        <div>
          <p className="overline mb-3">Styles I like</p>
          <div className="flex flex-wrap gap-2">
            {STYLE_TASTES.map((taste) => (
              <Tag
                key={taste}
                active={draft.likes.includes(taste)}
                onClick={() => setDraft({ ...draft, likes: toggle(draft.likes, taste) })}
              >
                {TASTE_LABELS[taste]}
              </Tag>
            ))}
          </div>
        </div>

        <div>
          <p className="overline mb-3">Styles I avoid</p>
          <div className="flex flex-wrap gap-2">
            {STYLE_TASTES.map((taste) => (
              <Tag
                key={taste}
                active={draft.avoids.includes(taste)}
                onClick={() => setDraft({ ...draft, avoids: toggle(draft.avoids, taste) })}
              >
                {TASTE_LABELS[taste]}
              </Tag>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <Button variant="text" onClick={onReset} className="text-clay">
          Reset
        </Button>
        <div className="flex gap-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onSave(draft)
              onClose()
            }}
          >
            Save style
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
