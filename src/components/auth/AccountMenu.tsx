import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../stores/AuthContext'
import { useSync } from '../../stores/SyncContext'
import { Icon } from '../ui/Icon'

const DOT: Record<string, string> = {
  idle: 'bg-forest',
  syncing: 'bg-beige-deep',
  offline: 'bg-ink-faint',
  error: 'bg-clay',
  guest: 'bg-ink-faint',
}

const LABEL: Record<string, string> = {
  idle: 'Synced',
  syncing: 'Syncing…',
  offline: 'Offline',
  error: 'Sync issue',
  guest: 'Guest',
}

export function AccountMenu() {
  const { status, user, configured, signOut } = useAuth()
  const { state, online, lastSyncedAt, retry } = useSync()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)

  if (status === 'loading') {
    return <span className="h-8 w-8 animate-pulse rounded-full bg-cream" aria-hidden="true" />
  }

  if (!user) {
    return (
      <Link
        to="/auth"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft transition-colors hover:text-ink"
        aria-label="Sign in or create an account"
      >
        <Icon name="user" size={16} />
        <span className="hidden lg:inline">Sign in</span>
      </Link>
    )
  }

  const initial = (user.email ?? '?').slice(0, 1).toUpperCase()

  return (
    <details className="group relative">
      <summary
        className="flex cursor-pointer list-none items-center gap-2 rounded-full border border-line bg-paper-raised py-1 pl-1 pr-2.5 transition-colors hover:border-ink/20 [&::-webkit-details-marker]:hidden"
        aria-label="Account menu"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-[0.6875rem] font-semibold text-paper">
          {initial}
        </span>
        <span className={`h-1.5 w-1.5 rounded-full ${DOT[state] ?? 'bg-ink-faint'}`} aria-hidden="true" />
        <span className="hidden max-w-[9rem] truncate text-xs text-ink-soft lg:inline">
          {user.email}
        </span>
        <Icon name="chevron-right" size={12} className="rotate-90 text-ink-faint" />
      </summary>

      <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-2xl border border-line bg-paper-raised p-4 shadow-xl">
        <p className="overline">Signed in</p>
        <p className="mt-1 truncate text-sm font-medium text-ink">{user.email}</p>

        <div className="mt-3 flex items-center justify-between rounded-xl border border-line bg-cream/30 px-3 py-2">
          <span className="flex items-center gap-2 text-xs text-ink-soft">
            <span className={`h-1.5 w-1.5 rounded-full ${DOT[state] ?? 'bg-ink-faint'}`} />
            {LABEL[state] ?? 'Sync'}
          </span>
          <button
            type="button"
            onClick={retry}
            disabled={!online || state === 'syncing'}
            className="text-[0.6875rem] font-medium text-ink underline-offset-4 hover:underline disabled:opacity-40"
          >
            Sync
          </button>
        </div>
        <p className="mt-1.5 text-[0.625rem] text-ink-faint">
          {lastSyncedAt
            ? `Last synced ${new Date(lastSyncedAt).toLocaleString()}`
            : 'Waiting for the first sync'}
        </p>

        <div className="mt-3 space-y-1 border-t border-line pt-3">
          <Link
            to="/auth"
            className="flex items-center gap-2 rounded-lg px-2 py-2 text-xs text-ink-soft transition-colors hover:bg-cream/50 hover:text-ink"
          >
            <Icon name="user" size={14} />
            Account &amp; sync
          </Link>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              await signOut()
              setBusy(false)
              navigate('/')
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-xs text-ink-soft transition-colors hover:bg-cream/50 hover:text-ink disabled:opacity-50"
          >
            <Icon name="logout" size={14} />
            Sign out
          </button>
        </div>

        {!configured && (
          <p className="mt-3 text-[0.625rem] leading-relaxed text-clay">
            Cloud is not configured in this build. Your data stays on this device.
          </p>
        )}
      </div>
    </details>
  )
}
