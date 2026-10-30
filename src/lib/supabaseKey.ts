/**
 * Guard rails for the browser Supabase key.
 *
 * FITIQ may only ever ship a publishable/anon key in the client bundle.
 * A secret or service-role key would bypass Row Level Security, so the app
 * refuses to initialise the cloud client if one is configured by mistake.
 * The key itself is never logged or rendered.
 */

export interface PublicKeyCheck {
  ok: boolean
  /** Short, safe-to-display reason when the key is rejected. */
  reason?: string
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    const json = atob(padded)
    return JSON.parse(json) as Record<string, unknown>
  } catch {
    return null
  }
}

export function validatePublicKey(key: string): PublicKeyCheck {
  const trimmed = key.trim()
  if (!trimmed) return { ok: false, reason: 'No Supabase publishable key configured.' }

  // New-format keys are self-describing.
  if (trimmed.startsWith('sb_secret_')) {
    return { ok: false, reason: 'A Supabase secret key must never be used in the browser.' }
  }
  if (trimmed.startsWith('sb_publishable_')) return { ok: true }

  // Legacy JWT keys carry their role in the payload.
  const payload = decodeJwtPayload(trimmed)
  if (payload) {
    if (payload.role === 'service_role') {
      return { ok: false, reason: 'A service-role key must never be used in the browser.' }
    }
    return { ok: true }
  }

  // Unknown but non-secret format: allow it and let the server reject it.
  return { ok: true }
}

/** True when a URL looks like a Supabase project URL (https only). */
export function validateSupabaseUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:'
  } catch {
    return false
  }
}
