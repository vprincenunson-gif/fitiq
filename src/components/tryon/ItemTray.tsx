import type { Garment, GarmentCategory } from '../../lib/types'
import { CATEGORY_LABELS } from '../../lib/types'
import { Icon } from '../ui/Icon'

interface ItemTrayProps {
  garments: Garment[]
  activeIds: Set<string>
  onSelect: (garment: Garment) => void
}

const CATEGORIES: GarmentCategory[] = ['shirt', 'pants', 'shoes']

/** Wardrobe tray: tap an item to set it in the current outfit. */
export function ItemTray({ garments, activeIds, onSelect }: ItemTrayProps) {
  return (
    <div className="space-y-6">
      {CATEGORIES.map((category) => {
        const items = garments.filter((g) => g.category === category)
        if (items.length === 0) return null
        return (
          <div key={category}>
            <p className="overline mb-3">{CATEGORY_LABELS[category]}</p>
            <div className="flex gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {items.map((garment) => {
                const active = activeIds.has(garment.id)
                return (
                  <button
                    key={garment.id}
                    type="button"
                    onClick={() => onSelect(garment)}
                    aria-pressed={active}
                    className={[
                      'group relative w-24 shrink-0 snap-start rounded-xl border text-left transition-[border-color,box-shadow,transform] duration-200 ease-editorial',
                      active
                        ? 'border-ink bg-paper-raised shadow-sm'
                        : 'border-line bg-paper-raised hover:border-ink/30 hover:shadow-lift hover:-translate-y-0.5',
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
