import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useWardrobe } from '../stores/WardrobeContext'
import { CategoryFilter, type CategoryFilterValue } from '../components/wardrobe/CategoryFilter'
import { WardrobeGrid } from '../components/wardrobe/WardrobeGrid'
import { Button } from '../components/ui/Button'
import { Icon } from '../components/ui/Icon'
import { EmptyState } from '../components/ui/EmptyState'
import { Overline } from '../components/ui/Overline'

export function WardrobePage() {
  const { garments, ready } = useWardrobe()
  const [searchParams, setSearchParams] = useSearchParams()
  const urlCat = searchParams.get('cat')

  const initialFilter: CategoryFilterValue =
    urlCat === 'shirt' || urlCat === 'pants' || urlCat === 'shoes' ? urlCat : 'all'

  const [filter, setFilter] = useState<CategoryFilterValue>(initialFilter)

  const counts = useMemo(() => {
    const result: Partial<Record<CategoryFilterValue, number>> = {}
    for (const g of garments) result[g.category] = (result[g.category] ?? 0) + 1
    return result
  }, [garments])

  const visible = useMemo(() => {
    if (filter === 'all') return garments
    return garments.filter((g) => g.category === filter)
  }, [garments, filter])

  const handleFilter = (value: CategoryFilterValue) => {
    setFilter(value)
    if (value === 'all') {
      setSearchParams({}, { replace: true })
    } else {
      setSearchParams({ cat: value }, { replace: true })
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <Overline>Your wardrobe</Overline>
          <h1 className="mt-2 font-display text-3xl md:text-4xl">Everything you own.</h1>
        </div>
        <Link to="/scan">
          <Button variant="ghost">
            <Icon name="camera" size={16} />
            Scan new item
          </Button>
        </Link>
      </div>

      <div className="mt-8">
        <CategoryFilter value={filter} onChange={handleFilter} counts={counts} />
      </div>

      <div className="mt-8">
        <WardrobeGrid
          garments={visible}
          loading={!ready}
          empty={
            <EmptyState
              icon="hanger"
              headline={filter === 'all' ? 'Your wardrobe is empty' : 'No items in this category'}
              copy="Scan your first item to bring it into your digital wardrobe."
              action={
                <Link to="/scan">
                  <Button>
                    <Icon name="camera" size={16} />
                    Scan your first item
                  </Button>
                </Link>
              }
            />
          }
        />
      </div>
    </div>
  )
}
