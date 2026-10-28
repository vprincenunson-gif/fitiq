import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'

interface CameraErrorStateProps {
  message: string
  onRetry: () => void
}

export function CameraErrorState({ message, onRetry }: CameraErrorStateProps) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-6 py-16 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full border border-line bg-paper-raised text-ink-soft">
        <Icon name="camera" size={24} />
      </span>
      <div className="space-y-2">
        <h2 className="font-display text-xl">Camera unavailable</h2>
        <p className="text-sm text-ink-soft">{message}</p>
      </div>
      <Button variant="ghost" onClick={onRetry}>
        Try again
      </Button>
    </div>
  )
}
