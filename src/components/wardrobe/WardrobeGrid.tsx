import type { Garment } from '../../lib/types'
import { GarmentCard } from './GarmentCard'
import { Skeleton } from '../ui/Skeleton'

interface WardrobeGridProps {
  garments: Garment[]
  loading?: boolean
  empty?: React.ReactNode
  inOutfitIds?: Set<string>
}

export function WardrobeGrid({ garments, loading = false, empty, inOutfitIds }: WardrobeGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="aspect-[4/5] rounded-2xl" />
        ))}
      </div>
    )
  }

  if (garments.length === 0) {
    return <>{empty}</>
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
      {garments.map((garment) => (
        <GarmentCard
          key={garment.id}
          garment={garment}
          inOutfit={inOutfitIds?.has(garment.id)}
        />
      ))}
    </div>
  )
}
