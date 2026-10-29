import type { WearStatus } from '../../lib/types'
import {
  WEAR_STATUS_SHORT_LABELS,
  WEAR_STATUS_LABELS,
  WEAR_STATUS_VALUES,
  garmentWearStatus,
} from '../../lib/types'

interface WearStatusSelectorProps {
  value?: WearStatus
  /** True once a change handler is provided; buttons render inert otherwise. */
  onChange?: (status: WearStatus) => void
  /** Accessible name so the four chips read as one control. */
  label?: string
}

/**
 * Compact wear-status picker: four small, easy-to-tap chips that sit
 * directly below a garment photo. Active chip is filled ink; inactive
 * chips stay quiet so the photo remains the focal point.
 */
export function WearStatusSelector({ value, onChange, label = 'Wear status' }: WearStatusSelectorProps) {
  const current = value ? garmentWearStatus({ wearStatus: value }) : undefined
  return (
    <div
      className="flex items-stretch gap-1 px-2 pt-2"
      role={onChange ? 'radiogroup' : undefined}
      aria-label={label}
    >
      {WEAR_STATUS_VALUES.map((status) => {
        const active = current === status
        return (
          <button
            key={status}
            type="button"
            role={onChange ? 'radio' : undefined}
            aria-checked={onChange ? active : undefined}
            title={WEAR_STATUS_LABELS[status]}
            disabled={!onChange}
            onClick={() => onChange?.(status)}
            className={[
              'flex h-7 min-w-0 flex-1 items-center justify-center rounded-full border px-1',
              'text-[0.625rem] font-medium leading-none tracking-wide whitespace-nowrap',
              'transition-[background-color,border-color,color,box-shadow] duration-200 ease-editorial',
              active
                ? 'border-ink bg-ink text-paper shadow-sm'
                : 'border-line text-ink-faint hover:border-ink/30 hover:text-ink',
              onChange ? 'cursor-pointer' : 'cursor-default',
            ].join(' ')}
          >
            {WEAR_STATUS_SHORT_LABELS[status]}
          </button>
        )
      })}
    </div>
  )
}
