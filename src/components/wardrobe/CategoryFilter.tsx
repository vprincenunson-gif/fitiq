import { Tag } from '../ui/Tag'
import type { GarmentCategory } from '../../lib/types'
import { CATEGORY_LABELS } from '../../lib/types'

export type CategoryFilterValue = 'all' | GarmentCategory

interface CategoryFilterProps {
  value: CategoryFilterValue
  onChange: (value: CategoryFilterValue) => void
  counts?: Partial<Record<CategoryFilterValue, number>>
}

const OPTIONS: CategoryFilterValue[] = ['all', 'shirt', 'pants', 'shoes']

export function CategoryFilter({ value, onChange, counts }: CategoryFilterProps) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
      {OPTIONS.map((option) => {
        const label = option === 'all' ? 'All' : CATEGORY_LABELS[option]
        const count = counts?.[option] ?? 0
        return (
          <Tag key={option} active={value === option} onClick={() => onChange(option)}>
            {label}
            {option !== 'all' && count > 0 && (
              <span className="opacity-60">{count}</span>
            )}
          </Tag>
        )
      })}
    </div>
  )
}
