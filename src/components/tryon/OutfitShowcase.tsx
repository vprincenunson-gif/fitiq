import type { Garment, OutfitComposition } from '../../lib/types'
import { Icon } from '../ui/Icon'

interface OutfitShowcaseProps {
  outfit: OutfitComposition
  composing?: boolean
}

const SLOTS = [
  { key: 'top', category: 'Shirt', label: 'Top' },
  { key: 'bottom', category: 'Pants', label: 'Bottom' },
  { key: 'shoes', category: 'Shoes', label: 'Shoes' },
] as const

type SlotKey = (typeof SLOTS)[number]['key']

const SLOT_GARMENT: Record<SlotKey, keyof OutfitComposition> = {
  top: 'top',
  bottom: 'bottom',
  shoes: 'shoes',
}

const FIT_LABELS: Record<Garment['fit'], string> = {
  slim: 'Slim fit',
  regular: 'Regular fit',
  relaxed: 'Relaxed fit',
}

function PiecePanel({ garment, slot }: { garment: Garment | null; slot: (typeof SLOTS)[number] }) {
  return (
    <div className="flex min-h-0 flex-col">
      <div className="relative flex aspect-[4/5] items-center justify-center overflow-hidden rounded-2xl bg-cream/40 img-shell">
        {garment ? (
          <img
            src={garment.image}
            alt={`${garment.name} — ${slot.category.toLowerCase()}`}
            className="max-h-full max-w-full object-contain"
            style={{ filter: 'drop-shadow(0 12px 24px rgb(22 19 16 / 0.14))' }}
          />
        ) : (
          <div className="flex flex-col items-center gap-3 text-ink-faint">
            <span className="flex h-14 w-14 items-center justify-center rounded-full border border-line bg-paper-raised">
              <Icon name="plus" size={20} />
            </span>
            <p className="text-xs font-medium uppercase tracking-wider">Not selected</p>
            <p className="text-[0.6875rem] text-ink-faint">pick from the tray below</p>
          </div>
        )}
      </div>
      <div className="mt-4">
        <p className="overline">{slot.category}</p>
        <p className="mt-1 truncate font-display text-[1.0625rem] leading-snug text-ink">
          {garment ? garment.name : `No ${slot.label.toLowerCase()} yet`}
        </p>
        {garment && (
          <>
            <p className="mt-1 text-xs text-ink-faint">
              {garment.colorLabel} · {FIT_LABELS[garment.fit]}
            </p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {garment.styleTags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-line bg-cream/50 px-2.5 py-0.5 text-[0.6875rem] font-medium text-ink-soft"
                >
                  {tag}
                </span>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/**
 * "Your Fit" — the outfit showcase. The selected shirt, pants and shoes are
 * presented as three large, individual pieces — their real wardrobe images —
 * arranged as one cohesive editorial triptych. The clothing is the hero.
 */
export function OutfitShowcase({ outfit, composing = false }: OutfitShowcaseProps) {
  const selected = SLOTS.filter((slot) => outfit[SLOT_GARMENT[slot.key]]).length
  const complete = selected === 3

  return (
    <section className="surface overflow-hidden rounded-3xl" aria-label="Your outfit showcase">
      <div className="flex items-baseline justify-between border-b border-line px-6 py-5 md:px-8">
        <div>
          <p className="overline">Your Fit</p>
          <h2 className="mt-1 font-display text-2xl">Your selected look.</h2>
        </div>
        <p
          className={[
            'inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider',
            complete ? 'text-forest' : 'text-ink-faint',
          ].join(' ')}
        >
          {complete && <Icon name="check" size={13} />}
          {complete ? 'Complete look' : `${selected} of 3 pieces`}
        </p>
      </div>

      <div
        className="grid grid-cols-1 divide-y divide-line sm:grid-cols-3 sm:divide-y-0 sm:divide-x"
        style={{
          opacity: composing ? 0.5 : 1,
          transition: 'opacity 500ms var(--ease-editorial)',
        }}
      >
        {SLOTS.map((slot) => (
          <div key={slot.key} className="p-6 md:p-7">
            <PiecePanel garment={outfit[SLOT_GARMENT[slot.key]]} slot={slot} />
          </div>
        ))}
      </div>
    </section>
  )
}
