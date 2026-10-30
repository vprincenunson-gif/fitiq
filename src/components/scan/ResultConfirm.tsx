import { useState } from 'react'
import type { DetectedGarment, GarmentCategory } from '../../lib/types'
import { CATEGORY_LABELS, GARMENT_CATEGORIES, genericGarmentName } from '../../lib/types'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'

interface ResultConfirmProps {
  detected: DetectedGarment
  /** The actual camera capture that will be stored as the item's image. */
  capturedImage?: string | null
  onAdd: (name: string, category: GarmentCategory, colorLabel: string) => void
  onRescan: () => void
}

export function ResultConfirm({ detected, capturedImage, onAdd, onRescan }: ResultConfirmProps) {
  const [name, setName] = useState(detected.name)
  const [category, setCategory] = useState<GarmentCategory>(detected.category)
  const [colorLabel, setColorLabel] = useState(detected.colorLabel)
  // Once the user renames the item, we stop regenerating it from metadata.
  const [nameEdited, setNameEdited] = useState(false)

  const genericName = genericGarmentName(colorLabel, category)

  const changeCategory = (next: GarmentCategory) => {
    setCategory(next)
    if (!nameEdited) setName(genericGarmentName(colorLabel, next))
  }

  const changeColor = (next: string) => {
    setColorLabel(next)
    if (!nameEdited) setName(genericGarmentName(next, category))
  }

  return (
    <div className="mx-auto w-full max-w-lg">
      <div className="surface overflow-hidden rounded-2xl">
        <div className="flex items-center justify-center bg-cream/60 py-10">
          <img
            src={capturedImage ?? detected.image}
            alt={`Captured photo of ${genericName}`}
            className="h-56 w-56 object-contain"
          />
        </div>

        <div className="space-y-5 p-7">
          <div>
            <p className="overline mb-2">Detected</p>
            <p className="font-display text-xl text-ink">{genericName}</p>
            {detected.source === 'vision' && typeof detected.confidence === 'number' && (
              <p className="mt-1 text-xs text-ink-faint">
                Groq Vision · {Math.round(detected.confidence * 100)}% confidence
              </p>
            )}
            {detected.source === 'local' && (
              <p className="mt-1 text-xs text-ink-faint">
                {detected.fallback
                  ? 'On-device fallback (AI unavailable)'
                  : 'On-device analysis'}
              </p>
            )}
          </div>

          <label className="block">
            <span className="overline mb-2 block">Item name</span>
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setNameEdited(true)
              }}
              className="w-full border-b border-line bg-transparent py-2 text-sm text-ink outline-none focus:border-beige-deep"
            />
          </label>

          <div className="grid grid-cols-2 gap-5">
            <label className="block">
              <span className="overline mb-2 block">Category</span>
              <select
                value={category}
                onChange={(e) => changeCategory(e.target.value as GarmentCategory)}
                className="w-full border-b border-line bg-paper-raised py-2 text-sm text-ink outline-none focus:border-beige-deep"
              >
                {GARMENT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="overline mb-2 block">Color</span>
              <input
                value={colorLabel}
                onChange={(e) => changeColor(e.target.value)}
                className="w-full border-b border-line bg-transparent py-2 text-sm text-ink outline-none focus:border-beige-deep"
              />
            </label>
          </div>

          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <Button onClick={() => onAdd(name.trim() || genericName, category, colorLabel.trim() || detected.colorLabel)} fullWidth>
              <Icon name="check" size={16} />
              Add to wardrobe
            </Button>
            <Button variant="ghost" onClick={onRescan} fullWidth>
              Rescan
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
