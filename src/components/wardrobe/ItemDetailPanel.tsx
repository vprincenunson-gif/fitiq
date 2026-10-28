import { useEffect, useState } from 'react'
import type { Garment, GarmentCategory, GarmentColor, GarmentFit } from '../../lib/types'
import { CATEGORY_LABELS } from '../../lib/types'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'

interface ItemDetailPanelProps {
  garment: Garment
  onUpdate: (patch: Partial<Garment>) => void
  onDelete: () => void
  onAddToOutfit: () => void
}

const COLOR_OPTIONS: GarmentColor[] = [
  'white', 'black', 'oat', 'beige', 'charcoal', 'navy',
  'olive', 'clay', 'sand', 'tan', 'denim',
]

const FIT_OPTIONS: GarmentFit[] = ['slim', 'regular', 'relaxed']

const MAX_TAGS = 6

interface Draft {
  name: string
  category: GarmentCategory
  color: GarmentColor
  colorLabel: string
  fit: GarmentFit
  styleTags: string[]
}

export function ItemDetailPanel({ garment, onUpdate, onDelete, onAddToOutfit }: ItemDetailPanelProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Draft>(() => ({
    name: garment.name,
    category: garment.category,
    color: garment.color,
    colorLabel: garment.colorLabel,
    fit: garment.fit,
    styleTags: garment.styleTags,
  }))

  // Keep the draft in sync when navigating between items.
  useEffect(() => {
    setDraft({
      name: garment.name,
      category: garment.category,
      color: garment.color,
      colorLabel: garment.colorLabel,
      fit: garment.fit,
      styleTags: garment.styleTags,
    })
  }, [garment.id])

  const addTag = (raw: string) => {
    const tag = raw.trim().toLowerCase().replace(/\s+/g, '-')
    if (!tag) return
    setDraft((d) =>
      d.styleTags.includes(tag) || d.styleTags.length >= MAX_TAGS
        ? d
        : { ...d, styleTags: [...d.styleTags, tag] },
    )
  }

  const save = () => {
    onUpdate({
      name: draft.name.trim() || garment.name,
      category: draft.category,
      color: draft.color,
      colorLabel: draft.colorLabel.trim() || draft.color,
      fit: draft.fit,
      styleTags: draft.styleTags,
    })
    setEditing(false)
  }

  const cancel = () => {
    setDraft({
      name: garment.name,
      category: garment.category,
      color: garment.color,
      colorLabel: garment.colorLabel,
      fit: garment.fit,
      styleTags: garment.styleTags,
    })
    setEditing(false)
  }

  return (
    <div className="surface rounded-2xl p-8">
      {/* Header row: title + favorite heart + edit/save actions */}
      <div className="flex items-start justify-between gap-4">
        {editing ? (
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            aria-label="Item name"
            className="w-full border-b border-line bg-transparent font-display text-2xl text-ink outline-none focus:border-beige-deep"
          />
        ) : (
          <h1 className="font-display text-2xl">{garment.name}</h1>
        )}

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => onUpdate({ favorite: !garment.favorite })}
            aria-label={garment.favorite ? 'Remove from favorites' : 'Add to favorites'}
            aria-pressed={garment.favorite}
            className={[
              'flex h-10 w-10 items-center justify-center rounded-full border transition-colors',
              garment.favorite
                ? 'border-beige-deep bg-beige/20 text-beige-deep'
                : 'border-line text-ink-faint hover:text-ink',
            ].join(' ')}
          >
            <Icon name="heart" size={18} />
          </button>
          {editing ? (
            <>
              <Button size="sm" onClick={save}>
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={cancel}>
                Cancel
              </Button>
            </>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
              Edit
            </Button>
          )}
        </div>
      </div>

      <p className="mt-1 text-xs uppercase tracking-wider text-ink-faint">
        {garment.favorite ? 'Favorite' : ''}
      </p>

      {/* Metadata: editable selects in edit mode, rows otherwise */}
      {editing ? (
        <div className="mt-6 grid grid-cols-2 gap-5">
          <label className="block">
            <span className="overline mb-2 block">Category</span>
            <select
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value as GarmentCategory })}
              className="w-full border-b border-line bg-paper-raised py-2 text-sm text-ink outline-none focus:border-beige-deep"
            >
              {(Object.keys(CATEGORY_LABELS) as GarmentCategory[]).map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="overline mb-2 block">Fit</span>
            <select
              value={draft.fit}
              onChange={(e) => setDraft({ ...draft, fit: e.target.value as GarmentFit })}
              className="w-full border-b border-line bg-paper-raised py-2 text-sm text-ink outline-none focus:border-beige-deep"
            >
              {FIT_OPTIONS.map((f) => (
                <option key={f} value={f}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="overline mb-2 block">Color tone</span>
            <select
              value={draft.color}
              onChange={(e) => setDraft({ ...draft, color: e.target.value as GarmentColor })}
              className="w-full border-b border-line bg-paper-raised py-2 text-sm text-ink outline-none focus:border-beige-deep"
            >
              {COLOR_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c.charAt(0).toUpperCase() + c.slice(1)}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="overline mb-2 block">Color label</span>
            <input
              value={draft.colorLabel}
              onChange={(e) => setDraft({ ...draft, colorLabel: e.target.value })}
              className="w-full border-b border-line bg-transparent py-2 text-sm text-ink outline-none focus:border-beige-deep"
            />
          </label>
        </div>
      ) : (
        <dl className="mt-6 space-y-3 text-sm">
          <Row label="Category" value={CATEGORY_LABELS[garment.category]} />
          <Row label="Color" value={garment.colorLabel} />
          <Row label="Fit" value={garment.fit.charAt(0).toUpperCase() + garment.fit.slice(1)} />
          <Row label="Source" value={garment.source === 'scanned' ? 'Scanned' : 'Sample'} />
          {garment.scannedAt && (
            <Row label="Scanned" value={new Date(garment.scannedAt).toLocaleDateString()} />
          )}
        </dl>
      )}

      {/* Style tags: editable chips in edit mode */}
      {editing ? (
        <div className="mt-6">
          <span className="overline block">Style tags</span>
          <div className="mt-3 flex flex-wrap gap-2">
            {draft.styleTags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-cream/60 px-3 py-1 text-xs font-medium text-ink"
              >
                {tag}
                <button
                  type="button"
                  onClick={() =>
                    setDraft({ ...draft, styleTags: draft.styleTags.filter((t) => t !== tag) })
                  }
                  aria-label={`Remove tag ${tag}`}
                  className="text-ink-faint hover:text-ink"
                >
                  <Icon name="x" size={12} />
                </button>
              </span>
            ))}
            {draft.styleTags.length < MAX_TAGS && (
              <input
                placeholder="Add tag…"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addTag((e.target as HTMLInputElement).value)
                    ;(e.target as HTMLInputElement).value = ''
                  }
                }}
                className="w-28 border-b border-line bg-transparent py-1 text-xs text-ink outline-none focus:border-beige-deep"
              />
            )}
          </div>
          <p className="mt-2 text-xs text-ink-faint">
            Enter to add · up to {MAX_TAGS} tags
          </p>
        </div>
      ) : (
        <div className="mt-6 flex flex-wrap gap-2">
          {garment.styleTags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-line bg-cream/60 px-3 py-1 text-xs font-medium text-ink-soft"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="mt-8 flex flex-col gap-3">
        <Button onClick={onAddToOutfit} fullWidth>
          <Icon name="hanger" size={16} />
          Add to outfit
        </Button>
        <Button variant="ghost" onClick={() => onUpdate({ favorite: !garment.favorite })} fullWidth>
          <Icon name="heart" size={16} />
          {garment.favorite ? 'Remove from favorites' : 'Add to favorites'}
        </Button>
        {!editing && (
          <Button variant="text" onClick={onDelete} className="text-clay">
            Remove item
          </Button>
        )}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-line/60 pb-3">
      <dt className="text-ink-faint">{label}</dt>
      <dd className="font-medium text-ink">{value}</dd>
    </div>
  )
}
