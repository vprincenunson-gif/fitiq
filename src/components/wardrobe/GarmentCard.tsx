import { Link } from 'react-router-dom'
import type { Garment, WearStatus } from '../../lib/types'
import { CATEGORY_SINGULAR, garmentWearStatus } from '../../lib/types'
import { WearStatusSelector } from './WearStatusSelector'
import { Icon } from '../ui/Icon'

interface GarmentCardProps {
  garment: Garment
  inOutfit?: boolean
  onRemove?: (garment: Garment) => void
  showRemove?: boolean
  /** When provided, the compact wear-status selector is editable below the photo. */
  onSetStatus?: (status: WearStatus) => void
}

export function GarmentCard({
  garment,
  inOutfit = false,
  onRemove,
  showRemove = false,
  onSetStatus,
}: GarmentCardProps) {
  const nameRow = (
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
  )

  return (
    <div className="group surface overflow-hidden rounded-2xl transition-[box-shadow,border-color,transform] duration-300 ease-editorial group-hover:-translate-y-1.5 group-hover:border-line-strong">
      <Link
        to={`/items/${garment.id}`}
        className="img-shell relative block aspect-[4/5] bg-cream/40"
        aria-label={`View ${garment.name}`}
      >
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
          <span
            className="absolute left-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-paper/85 text-ink backdrop-blur-sm"
            aria-label="Favorite"
          >
            <Icon name="heart" size={14} />
          </span>
        )}
      </Link>

      {/* Wear status sits directly below the photo, outside the item link
          so taps change status without opening the item page. */}
      <div className="border-b border-line">
        <WearStatusSelector
          value={garmentWearStatus(garment)}
          onChange={onSetStatus}
          label={`Wear status for ${garment.name}`}
        />
      </div>

      <Link to={`/items/${garment.id}`} className="block" aria-label={`View ${garment.name}`}>
        {nameRow}
      </Link>
    </div>
  )
}
