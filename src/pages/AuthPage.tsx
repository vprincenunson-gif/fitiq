import { useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../stores/AuthContext'
import { useSync } from '../stores/SyncContext'
import { Button } from '../components/ui/Button'
import { Icon } from '../components/ui/Icon'
import { Overline } from '../components/ui/Overline'
import { Spinner } from '../components/ui/Spinner'

/* ────────────────────────────────────────────────────────────────────────
   Account & sync.

   Guest mode is always available. This page only adds optional cloud sync:
   sign up, sign in, reset a password, or manage the current session.
   ──────────────────────────────────────────────────────────────────────── */

type Mode = 'signin' | 'signup' | 'reset' | 'update'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function Field({
  id,
  label,
  type,
  value,
  onChange,
  autoComplete,
  placeholder,
  hint,
}: {
  id: string
  label: string
  type: string
  value: string
  onChange: (value: string) => void
  autoComplete: string
  placeholder?: string
  hint?: string
}) {
  return (
    <div>
      <label htmlFor={id} className="overline mb-2 block">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className="h-11 w-full rounded-xl border border-line bg-paper px-4 text-sm text-ink placeholder:text-ink-faint/70 transition-colors focus:border-beige-deep focus:outline-none"
      />
      {hint && <p className="mt-1.5 text-[0.6875rem] text-ink-faint">{hint}</p>}
    </div>
  )
}

function Notice({
  tone,
  children,
}: {
  tone: 'info' | 'error' | 'success'
  children: ReactNode
}) {
  const styles =
    tone === 'error'
      ? 'border-clay/30 bg-clay/5 text-clay'
      : tone === 'success'
        ? 'border-forest/25 bg-forest/5 text-forest'
        : 'border-line bg-cream/40 text-ink-soft'
  return (
    <div className={`rounded-xl border px-4 py-3 text-xs leading-relaxed ${styles}`} role={tone === 'error' ? 'alert' : undefined}>
      {children}
    </div>
  )
}

const SYNC_LABELS: Record<string, string> = {
  guest: 'Guest — saved on this device',
  idle: 'Synced',
  syncing: 'Syncing…',
  offline: 'Offline — changes saved locally',
  error: 'Sync needs attention',
}

export function AuthPage({ reset = false }: { reset?: boolean }) {
  const {
    status,
    user,
    configured,
    configReason,
    recovery,
    signIn,
    signUp,
    signOut,
    requestPasswordReset,
    updatePassword,
    resendConfirmation,
  } = useAuth()
  const { state: syncState, error: syncError, errorCode, lastSyncedAt, online, retry } = useSync()
  const navigate = useNavigate()
  const location = useLocation()
  const confirmed = new URLSearchParams(location.search).get('confirmed') === '1'

  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)

  // /auth/reset only shows the new-password form once the recovery link has
  // actually produced a session. Without one, request a fresh reset email.
  const activeMode: Mode = reset
    ? recovery || status === 'authenticated'
      ? 'update'
      : 'reset'
    : mode

  const passwordIssue = useMemo(() => {
    if (activeMode !== 'signup' && activeMode !== 'update') return null
    if (password.length === 0) return null
    if (password.length < 8) return 'Use at least 8 characters.'
    if (confirm.length > 0 && password !== confirm) return 'Passwords do not match.'
    return null
  }, [activeMode, password, confirm])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setFormError(null)
    setNotice(null)

    if (activeMode === 'reset') {
      if (!EMAIL.test(email.trim())) {
        setFormError('Enter a valid email address.')
        return
      }
      setBusy(true)
      const result = await requestPasswordReset(email)
      setBusy(false)
      if (result.error) setFormError(result.error)
      else setNotice('If that email has a FITIQ account, a reset link is on its way.')
      return
    }

    if (activeMode === 'signup') {
      if (!EMAIL.test(email.trim())) {
        setFormError('Enter a valid email address.')
        return
      }
      if (password.length < 8) {
        setFormError('Use at least 8 characters for your password.')
        return
      }
      if (password !== confirm) {
        setFormError('Passwords do not match.')
        return
      }
      setBusy(true)
      const result = await signUp(email, password)
      setBusy(false)
      if (result.error) {
        setFormError(result.error)
        return
      }
      if (result.needsConfirmation) {
        setPendingEmail(email.trim())
        setNotice('Check your inbox to confirm your email, then sign in.')
        setMode('signin')
      } else {
        navigate('/wardrobe')
      }
      return
    }

    if (activeMode === 'update') {
      if (password.length < 8) {
        setFormError('Use at least 8 characters for your password.')
        return
      }
      if (password !== confirm) {
        setFormError('Passwords do not match.')
        return
      }
      setBusy(true)
      const result = await updatePassword(password)
      setBusy(false)
      if (result.error) setFormError(result.error)
      else {
        setNotice('Password updated. You are signed in on this device.')
        navigate('/wardrobe')
      }
      return
    }

    if (!EMAIL.test(email.trim())) {
      setFormError('Enter a valid email address.')
      return
    }
    if (!password) {
      setFormError('Enter your password.')
      return
    }
    setBusy(true)
    const result = await signIn(email, password)
    setBusy(false)
    if (result.error) setFormError(result.error)
    else navigate('/wardrobe')
  }

  const resend = async () => {
    if (!pendingEmail) return
    setBusy(true)
    const result = await resendConfirmation(pendingEmail)
    setBusy(false)
    if (result.error) setFormError(result.error)
    else setNotice('Confirmation email sent again.')
  }

  if (status === 'loading') {
    return (
      <div className="surface flex items-center justify-center rounded-2xl py-24" aria-label="Loading your account">
        <Spinner size={26} />
      </div>
    )
  }

  if (status === 'authenticated' && user && !recovery) {
    return (
      <div className="mx-auto max-w-2xl">
        <Overline>Account</Overline>
        <h1 className="mt-2 font-display text-3xl leading-tight md:text-4xl">Your wardrobe, everywhere.</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          Signed in as <span className="font-medium text-ink">{user.email}</span>. Your wardrobe,
          photos, wear history, saved looks, planner and style profile sync privately across
          devices.
        </p>

        <div className="surface mt-8 rounded-2xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-cream text-ink-soft">
                <Icon name={syncState === 'offline' ? 'cloud-off' : 'cloud'} size={18} />
              </span>
              <div>
                <p className="text-sm font-medium text-ink">{SYNC_LABELS[syncState] ?? 'Sync'}</p>
                <p className="text-[0.6875rem] text-ink-faint">
                  {lastSyncedAt
                    ? `Last synced ${new Date(lastSyncedAt).toLocaleString()}`
                    : 'No sync completed yet'}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={retry} disabled={!online || syncState === 'syncing'}>
              <Icon name="refresh" size={14} />
              Sync now
            </Button>
          </div>

          {!online && (
            <div className="mt-4">
              <Notice tone="info">
                You are offline. Everything keeps working on this device and will sync when you
                reconnect.
              </Notice>
            </div>
          )}

          {syncError && (
            <div className="mt-4">
              <Notice tone="error">
                {syncError}
                {errorCode === 'schema-missing' && (
                  <span className="mt-1 block text-[0.6875rem] text-ink-soft">
                    A project owner needs to run <code>supabase/migrations/0001_fitiq_cloud.sql</code>{' '}
                    once. Your data is safe on this device.
                  </span>
                )}
                {errorCode === 'storage-missing' && (
                  <span className="mt-1 block text-[0.6875rem] text-ink-soft">
                    A project owner needs to create the private <code>wardrobe-photos</code> bucket.
                  </span>
                )}
              </Notice>
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
            <Link to="/wardrobe" className="text-xs font-medium text-ink underline-offset-4 hover:underline">
              Back to wardrobe
            </Link>
            <Button
              variant="ghost"
              size="sm"
              loading={busy}
              onClick={async () => {
                setBusy(true)
                await signOut()
                setBusy(false)
                navigate('/')
              }}
            >
              <Icon name="logout" size={15} />
              Sign out
            </Button>
          </div>
        </div>

        <p className="mt-5 text-[0.6875rem] leading-relaxed text-ink-faint">
          Signing out restores the guest wardrobe that lived on this device before you signed in.
          Your cloud data stays in your private account.
        </p>
      </div>
    )
  }

  const heading =
    activeMode === 'update'
      ? 'Choose a new password.'
      : activeMode === 'reset'
        ? 'Reset your password.'
        : activeMode === 'signup'
          ? 'Create your FITIQ account.'
          : 'Welcome back.'

  const subheading =
    activeMode === 'update'
      ? 'Your recovery link is verified. Set a new password to finish.'
      : activeMode === 'reset'
        ? 'We will email you a secure link to set a new password.'
        : activeMode === 'signup'
          ? 'Optional. Your wardrobe stays private and syncs across devices.'
          : 'Sign in to bring your wardrobe, wear history and plans to this device.'

  return (
    <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
      <aside className="lg:col-span-5">
        <Overline>Account &amp; sync</Overline>
        <h1 className="mt-2 font-display text-3xl leading-tight md:text-4xl">
          Your wardrobe,
          <br />
          everywhere.
        </h1>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-ink-soft">
          An account is optional. Sign in and your scanned pieces, original photos, Wear Status,
          wear history, saved outfits, Planner and My Style follow you to any device.
        </p>

        <ul className="mt-8 space-y-4">
          {[
            ['lock', 'Private by default', 'Strict Row Level Security means only you can read your rows and photos.'],
            ['cloud', 'Original photos, private storage', 'Captures live in your own private bucket, never a public URL.'],
            ['sparkle', 'Guest mode stays', 'Keep using FITIQ without an account. Local data is never deleted.'],
          ].map(([icon, title, copy]) => (
            <li key={title} className="flex gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line bg-paper-raised text-ink-soft">
                <Icon name={icon as 'lock' | 'cloud' | 'sparkle'} size={15} />
              </span>
              <div>
                <p className="text-sm font-medium text-ink">{title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">{copy}</p>
              </div>
            </li>
          ))}
        </ul>

        <p className="mt-8 text-[0.6875rem] leading-relaxed text-ink-faint">
          Groq Vision consent is unchanged: photos are only sent to the vision model after you
          explicitly agree, and outfit recommendations remain metadata-only.
        </p>
      </aside>

      <section className="lg:col-span-7">
        <div className="surface rounded-2xl p-6 md:p-8">
          <h2 className="font-display text-2xl">{heading}</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">{subheading}</p>

          {!configured && (
            <div className="mt-5">
              <Notice tone="error">
                Cloud accounts are unavailable in this build. {configReason} You can keep using
                FITIQ in guest mode.
              </Notice>
            </div>
          )}

          {!online && (
            <div className="mt-5">
              <Notice tone="info">You are offline. Reconnect to sign in or create an account.</Notice>
            </div>
          )}

          {confirmed && activeMode === 'signin' && (
            <div className="mt-5">
              <Notice tone="success">Email confirmed. Sign in to start syncing.</Notice>
            </div>
          )}

          {notice && (
            <div className="mt-5">
              <Notice tone="success">{notice}</Notice>
            </div>
          )}
          {formError && (
            <div className="mt-5">
              <Notice tone="error">{formError}</Notice>
            </div>
          )}

          <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
            {activeMode !== 'update' && (
              <Field
                id="email"
                label="Email"
                type="email"
                value={email}
                onChange={setEmail}
                autoComplete="email"
                placeholder="you@example.com"
              />
            )}

            {activeMode !== 'reset' && (
              <Field
                id="password"
                label={activeMode === 'update' ? 'New password' : 'Password'}
                type="password"
                value={password}
                onChange={setPassword}
                autoComplete={activeMode === 'signin' ? 'current-password' : 'new-password'}
                placeholder="At least 8 characters"
                hint={passwordIssue ?? undefined}
              />
            )}

            {(activeMode === 'signup' || activeMode === 'update') && (
              <Field
                id="confirm"
                label="Confirm password"
                type="password"
                value={confirm}
                onChange={setConfirm}
                autoComplete="new-password"
                placeholder="Repeat your password"
              />
            )}

            <Button
              type="submit"
              fullWidth
              loading={busy}
              disabled={!configured || !online}
            >
              {activeMode === 'update'
                ? 'Update password'
                : activeMode === 'reset'
                  ? 'Send reset link'
                  : activeMode === 'signup'
                    ? 'Create account'
                    : 'Sign in'}
              <Icon name="arrow-right" size={15} />
            </Button>
          </form>

          {pendingEmail && (
            <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-line bg-cream/30 px-4 py-3">
              <p className="text-xs text-ink-soft">Waiting for {pendingEmail} to be confirmed.</p>
              <button
                type="button"
                onClick={resend}
                disabled={busy}
                className="text-xs font-medium text-ink underline-offset-4 hover:underline disabled:opacity-50"
              >
                Resend
              </button>
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-5 text-xs">
            {activeMode === 'signin' && (
              <>
                <button type="button" onClick={() => setMode('signup')} className="font-medium text-ink underline-offset-4 hover:underline">
                  Create an account
                </button>
                <button type="button" onClick={() => setMode('reset')} className="text-ink-soft underline-offset-4 hover:text-ink hover:underline">
                  Forgot password?
                </button>
              </>
            )}
            {activeMode === 'signup' && (
              <button type="button" onClick={() => setMode('signin')} className="font-medium text-ink underline-offset-4 hover:underline">
                Already have an account? Sign in
              </button>
            )}
            {activeMode === 'reset' &&
              (reset ? (
                <Link to="/auth" className="font-medium text-ink underline-offset-4 hover:underline">
                  Back to sign in
                </Link>
              ) : (
                <button type="button" onClick={() => setMode('signin')} className="font-medium text-ink underline-offset-4 hover:underline">
                  Back to sign in
                </button>
              ))}
            <Link to="/" className="ml-auto text-ink-soft underline-offset-4 hover:text-ink hover:underline">
              Continue as guest
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
