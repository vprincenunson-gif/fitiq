import { Link } from 'react-router-dom'
import type { Garment } from '../../lib/types'
import { CATEGORY_SINGULAR } from '../../lib/types'
import { Icon } from '../ui/Icon'

interface GarmentCardProps {
  garment: Garment
  inOutfit?: boolean
  onRemove?: (garment: Garment) => void
  showRemove?: boolean
}

export function GarmentCard({ garment, inOutfit = false, onRemove, showRemove = false }: GarmentCardProps) {
  return (
    <div className="group relative">
      <Link
        to={`/items/${garment.id}`}
        className="surface block overflow-hidden rounded-2xl transition-transform duration-300 ease-editorial group-hover:-translate-y-1.5 group-hover:border-line-strong"
      >
        <div className="img-shell relative aspect-[4/5] bg-cream/40">
          <img
            src={garment.image}
            alt={garment.name}
            className="h-full w-full object-contain p-3 transition-transform duration-700 ease-editorial group-hover:scale-[1.06]"
            loading="lazy"
          />
          {inOutfit && (
            <span className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-ink text-paper shadow-sm">
              <Icon name="check" size={14} />
            </span>
          )}
          {garment.favorite && (
            <span className="absolute left-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-paper/85 backdrop-blur-sm text-ink" aria-label="Favorite">
              <Icon name="heart" size={14} />
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 px-4 py-3.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink">{garment.name}</p>
            <p className="mt-1 text-xs text-ink-faint">
              {CATEGORY_SINGULAR[garment.category]} · {garment.colorLabel}
            </p>
          </div>
          {showRemove && onRemove && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                onRemove(garment)
              }}
              aria-label={`Remove ${garment.name}`}
              className="ml-2 text-ink-faint transition-colors hover:text-ink"
            >
              <Icon name="x" size={16} />
            </button>
          )}
        </div>
      </Link>
    </div>
  )
}
