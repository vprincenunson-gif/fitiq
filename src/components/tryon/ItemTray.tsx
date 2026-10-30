import type { Garment } from '../../lib/types'
import { CATEGORY_LABELS, GARMENT_CATEGORIES, slotForCategory } from '../../lib/types'
import { Icon } from '../ui/Icon'

interface ItemTrayProps {
  garments: Garment[]
  activeIds: Set<string>
  onSelect: (garment: Garment) => void
}

/** Wardrobe tray: tap an item to set it in the current outfit. */
export function ItemTray({ garments, activeIds, onSelect }: ItemTrayProps) {
  return (
    <div className="space-y-6">
      {GARMENT_CATEGORIES.map((category) => {
        const items = garments.filter((g) => g.category === category)
        if (items.length === 0) return null
        const compose = slotForCategory(category) !== null
        return (
          <div key={category}>
            <p className="overline mb-3">
              {CATEGORY_LABELS[category]}
              {!compose && (
                <span className="ml-2 normal-case tracking-normal text-ink-faint">
                  · wardrobe only for now
                </span>
              )}
            </p>
            <div className="flex gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {items.map((garment) => {
                const active = activeIds.has(garment.id)
                return (
                  <button
                    key={garment.id}
                    type="button"
                    onClick={() => compose && onSelect(garment)}
                    disabled={!compose}
                    aria-pressed={active}
                    title={
                      compose
                        ? undefined
                        : `${CATEGORY_LABELS[category]} can’t be added to a look yet`
                    }
                    className={[
                      'group relative w-24 shrink-0 snap-start rounded-xl border text-left transition-[border-color,box-shadow,transform] duration-200 ease-editorial',
                      active
                        ? 'border-ink bg-paper-raised shadow-sm'
                        : 'border-line bg-paper-raised',
                      compose
                        ? 'hover:border-ink/30 hover:shadow-lift hover:-translate-y-0.5'
                        : 'opacity-50',
                    ].join(' ')}
                  >
                    <div className="flex aspect-square items-center justify-center p-2">
                      <img
                        src={garment.image}
                        alt={garment.name}
                        className="h-full w-full object-contain"
                        loading="lazy"
                      />
                    </div>
                    <p className="truncate px-2 pb-2 text-[0.6875rem] font-medium text-ink-soft">
                      {garment.name}
                    </p>
                    {active && (
                      <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-paper">
                        <Icon name="check" size={11} />
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
