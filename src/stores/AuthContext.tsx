import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, supabaseConfig } from '../lib/supabase'

/* ────────────────────────────────────────────────────────────────────────
   Supabase Auth.

   Guest mode is the default: no route requires an account. Signing in is
   optional and only adds cross-device sync. Sessions persist across reloads
   (supabase-js writes them to localStorage and refreshes tokens), and the
   provider exposes friendly, non-technical error copy for every flow.
   ──────────────────────────────────────────────────────────────────────── */

export type AuthStatus = 'loading' | 'guest' | 'authenticated'

export interface AuthResult {
  error: string | null
  /** Sign-up succeeded but Supabase requires email confirmation first. */
  needsConfirmation?: boolean
}

export interface AuthContextValue {
  status: AuthStatus
  user: User | null
  session: Session | null
  /** True while Supabase is configured and reachable enough to sign in. */
  configured: boolean
  configReason: string | null
  /** True after a password-recovery link established a session. */
  recovery: boolean
  signUp: (email: string, password: string) => Promise<AuthResult>
  signIn: (email: string, password: string) => Promise<AuthResult>
  signOut: () => Promise<AuthResult>
  requestPasswordReset: (email: string) => Promise<AuthResult>
  updatePassword: (password: string) => Promise<AuthResult>
  resendConfirmation: (email: string) => Promise<AuthResult>
  clearRecovery: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function friendlyAuthError(message: string | undefined): string {
  const text = (message ?? '').toLowerCase()
  if (text.includes('invalid login credentials')) return 'Email or password is incorrect.'
  if (text.includes('email not confirmed')) {
    return 'Confirm your email first — check your inbox for the FITIQ link.'
  }
  if (text.includes('user already registered')) {
    return 'That email already has an account. Try signing in instead.'
  }
  if (text.includes('password should be at least')) {
    return 'Use at least 8 characters for your password.'
  }
  if (text.includes('unable to validate email') || text.includes('invalid email')) {
    return 'Enter a valid email address.'
  }
  if (text.includes('rate limit') || text.includes('too many')) {
    return 'Too many attempts. Wait a moment and try again.'
  }
  if (text.includes('email link is invalid or has expired')) {
    return 'That link has expired. Request a fresh password reset email.'
  }
  if (text.includes('failed to fetch') || text.includes('network')) {
    return 'You appear to be offline. Reconnect and try again.'
  }
  return message?.trim() || 'Something went wrong. Please try again.'
}

const redirectTo = (path: string): string => `${window.location.origin}${path}`

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(supabase ? 'loading' : 'guest')
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [recovery, setRecovery] = useState(false)

  useEffect(() => {
    const client = supabase
    if (!client) {
      setStatus('guest')
      return
    }

    let active = true

    void client.auth.getSession().then(({ data, error }) => {
      if (!active) return
      if (error) {
        console.warn('[FITIQ] could not restore the saved session', error.message)
      }
      const next = data.session ?? null
      setSession(next)
      setUser(next?.user ?? null)
      setStatus(next ? 'authenticated' : 'guest')
    })

    const { data } = client.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      if (event === 'SIGNED_OUT') setRecovery(false)
      setSession(nextSession)
      setUser(nextSession?.user ?? null)
      setStatus(nextSession ? 'authenticated' : 'guest')
    })

    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  const signUp = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    if (!supabase) return { error: supabaseConfig.reason ?? 'Cloud accounts are unavailable.' }
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: redirectTo('/auth?confirmed=1') },
    })
    if (error) return { error: friendlyAuthError(error.message) }
    // With email confirmation enabled Supabase returns a user but no session.
    return { error: null, needsConfirmation: !data.session }
  }, [])

  const signIn = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    if (!supabase) return { error: supabaseConfig.reason ?? 'Cloud accounts are unavailable.' }
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    if (error) return { error: friendlyAuthError(error.message) }
    return { error: null }
  }, [])

  const signOut = useCallback(async (): Promise<AuthResult> => {
    if (!supabase) return { error: null }
    const { error } = await supabase.auth.signOut()
    if (error) return { error: friendlyAuthError(error.message) }
    return { error: null }
  }, [])

  const requestPasswordReset = useCallback(async (email: string): Promise<AuthResult> => {
    if (!supabase) return { error: supabaseConfig.reason ?? 'Cloud accounts are unavailable.' }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: redirectTo('/auth/reset'),
    })
    if (error) return { error: friendlyAuthError(error.message) }
    return { error: null }
  }, [])

  const updatePassword = useCallback(async (password: string): Promise<AuthResult> => {
    if (!supabase) return { error: supabaseConfig.reason ?? 'Cloud accounts are unavailable.' }
    const { error } = await supabase.auth.updateUser({ password })
    if (error) return { error: friendlyAuthError(error.message) }
    setRecovery(false)
    return { error: null }
  }, [])

  const resendConfirmation = useCallback(async (email: string): Promise<AuthResult> => {
    if (!supabase) return { error: supabaseConfig.reason ?? 'Cloud accounts are unavailable.' }
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
      options: { emailRedirectTo: redirectTo('/auth?confirmed=1') },
    })
    if (error) return { error: friendlyAuthError(error.message) }
    return { error: null }
  }, [])

  const clearRecovery = useCallback(() => setRecovery(false), [])

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      session,
      configured: supabaseConfig.configured,
      configReason: supabaseConfig.reason,
      recovery,
      signUp,
      signIn,
      signOut,
      requestPasswordReset,
      updatePassword,
      resendConfirmation,
      clearRecovery,
    }),
    [
      status,
      user,
      session,
      recovery,
      signUp,
      signIn,
      signOut,
      requestPasswordReset,
      updatePassword,
      resendConfirmation,
      clearRecovery,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
