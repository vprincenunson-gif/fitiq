import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { validatePublicKey, validateSupabaseUrl } from './supabaseKey'

/**
 * Browser Supabase client.
 *
 * Only the publishable/anon key is used. Sessions persist in localStorage and
 * tokens auto-refresh, so a signed-in user stays signed in across reloads.
 * When the environment is missing (or a secret key was configured by mistake)
 * the client is `null` and FITIQ stays fully usable in guest mode.
 */

const rawUrl = (import.meta.env.VITE_SUPABASE_URL ?? '').trim()
const rawKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '').trim()
const keyCheck = validatePublicKey(rawKey)
const urlOk = validateSupabaseUrl(rawUrl)

export interface SupabaseConfigStatus {
  configured: boolean
  url: string | null
  /** Safe, human-readable reason when cloud is unavailable. */
  reason: string | null
}

export const supabaseConfig: SupabaseConfigStatus = {
  configured: urlOk && keyCheck.ok,
  url: urlOk ? rawUrl : null,
  reason: !urlOk
    ? 'VITE_SUPABASE_URL is missing or is not an https URL.'
    : !keyCheck.ok
      ? keyCheck.reason ?? 'Supabase key rejected.'
      : null,
}

export const supabase: SupabaseClient | null = supabaseConfig.configured
  ? createClient(rawUrl, rawKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      global: {
        headers: { 'x-application-name': 'fitiq' },
      },
    })
  : null

export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(supabaseConfig.reason ?? 'Supabase is not configured.')
  }
  return supabase
}
