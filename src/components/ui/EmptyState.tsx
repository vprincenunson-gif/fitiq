import type { ReactNode } from 'react'
import { Icon } from './Icon'
import type { IconName } from './Icon'

interface EmptyStateProps {
  icon?: IconName
  headline: string
  copy?: string
  action?: ReactNode
}

export function EmptyState({ icon = 'sparkle', headline, copy, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full border border-line bg-paper-raised text-ink-soft">
        <Icon name={icon} size={24} />
      </span>
      <div className="space-y-1.5">
        <h3 className="font-display text-xl">{headline}</h3>
        {copy && <p className="max-w-sm text-sm text-ink-soft">{copy}</p>}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
