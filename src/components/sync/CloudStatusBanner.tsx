import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../stores/AuthContext'
import { useSync } from '../../stores/SyncContext'
import { Icon } from '../ui/Icon'

/**
 * A quiet, dismissible strip shown only when a signed-in user's cloud sync is
 * offline or needs attention. Guest mode never sees it.
 */
export function CloudStatusBanner() {
  const { user } = useAuth()
  const { state, error, errorCode, retry, online } = useSync()
  const [dismissed, setDismissed] = useState(false)

  if (!user || dismissed) return null
  if (state !== 'offline' && state !== 'error') return null

  const message =
    state === 'offline'
      ? 'Offline — changes are saved on this device and will sync when you reconnect.'
      : error ?? 'Cloud sync needs attention.'

  return (
    <div
      role="status"
      className="border-b border-line bg-cream/60 text-ink-soft"
    >
      <div className="container-editorial flex items-center gap-3 py-2 text-xs">
        <Icon name={state === 'offline' ? 'cloud-off' : 'cloud'} size={15} className="shrink-0 text-ink-faint" />
        <p className="min-w-0 flex-1 leading-relaxed">
          {message}
          {errorCode === 'schema-missing' && (
            <span className="ml-1 text-ink-faint">
              (Run the Supabase migration once — local data is untouched.)
            </span>
          )}
        </p>
        <button
          type="button"
          onClick={retry}
          disabled={!online}
          className="shrink-0 font-medium text-ink underline-offset-4 hover:underline disabled:opacity-40"
        >
          Retry
        </button>
        <Link to="/auth" className="shrink-0 text-ink-faint hover:text-ink">
          Details
        </Link>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss sync notice"
          className="shrink-0 text-ink-faint hover:text-ink"
        >
          <Icon name="x" size={14} />
        </button>
      </div>
    </div>
  )
}
