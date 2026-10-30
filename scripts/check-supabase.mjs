#!/usr/bin/env node
/**
 * FITIQ cloud readiness check.
 *
 * Uses only the publishable key from .env. Never prints the key or any token.
 * Run: node scripts/check-supabase.mjs
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { validatePublicKey, validateSupabaseUrl } from '../src/lib/supabaseKey.ts'

const TABLES = ['wardrobe_items', 'wear_log', 'saved_outfits', 'planner_days', 'style_profiles']
const BUCKET = 'wardrobe-photos'

function readEnv(path) {
  const env = {}
  try {
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
      if (!line || line.trim().startsWith('#')) continue
      const index = line.indexOf('=')
      if (index === -1) continue
      env[line.slice(0, index).trim()] = line.slice(index + 1).trim()
    }
  } catch {
    /* missing .env is reported below */
  }
  return env
}

const env = readEnv(resolve(process.cwd(), '.env'))
const url = env.VITE_SUPABASE_URL ?? ''
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ''
const keyCheck = validatePublicKey(key)

let failed = false
const line = (ok, label, detail = '') => {
  if (!ok) failed = true
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
}

if (!validateSupabaseUrl(url)) {
  line(false, 'VITE_SUPABASE_URL', 'missing or not an https URL')
  process.exit(1)
}
if (!keyCheck.ok) {
  line(false, 'VITE_SUPABASE_PUBLISHABLE_KEY', keyCheck.reason ?? 'rejected')
  process.exit(1)
}
line(true, 'environment', new URL(url).host)

const headers = { apikey: key, Authorization: `Bearer ${key}` }
const timeout = AbortSignal.timeout(15000)

try {
  const health = await fetch(`${url}/auth/v1/health`, { headers, signal: timeout })
  line(health.ok, 'Auth reachable', `HTTP ${health.status}`)
} catch (error) {
  line(false, 'Auth reachable', error.message)
}

try {
  const settings = await fetch(`${url}/auth/v1/settings`, { headers, signal: timeout })
  const json = await settings.json()
  line(
    settings.ok,
    'Auth settings',
    `signup ${json.disable_signup ? 'disabled' : 'enabled'} · email confirmation ${
      json.mailer_autoconfirm ? 'off' : 'on'
    }`,
  )
} catch (error) {
  line(false, 'Auth settings', error.message)
}

/** Read a response body once, tolerating empty/non-JSON payloads. */
async function readJson(response) {
  const raw = await response.text()
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

for (const table of TABLES) {
  try {
    const response = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, {
      headers,
      signal: timeout,
    })
    if (response.status === 404) {
      line(false, `table ${table}`, 'missing — run supabase/migrations/0001_fitiq_cloud.sql')
      continue
    }
    const rows = await readJson(response)
    // 401/403 is the expected answer once anon is revoked. A 200 is only a
    // leak if it actually returns rows; an empty array means RLS filtered them.
    if (Array.isArray(rows) && rows.length > 0) {
      line(false, `table ${table}`, `anonymous read returned ${rows.length} row(s) — RLS is not protecting it`)
    } else if (response.ok) {
      line(true, `table ${table}`, 'exists; anonymous read is empty (RLS enforced)')
    } else if (response.status === 401 || response.status === 403) {
      line(true, `table ${table}`, `exists; anonymous access denied (HTTP ${response.status})`)
    } else {
      line(false, `table ${table}`, `unexpected HTTP ${response.status}`)
    }
  } catch (error) {
    line(false, `table ${table}`, error.message)
  }
}

try {
  // Listing a private bucket anonymously returns an empty array, and so does a
  // missing bucket — so ask for bucket metadata to tell the two apart.
  const detail = await fetch(`${url}/storage/v1/bucket/${BUCKET}`, { headers, signal: timeout })
  const meta = await readJson(detail)
  const missing =
    detail.status === 404 ||
    meta?.code === 'NoSuchBucket' ||
    /bucket not found/i.test(meta?.message ?? '')

  if (missing) {
    line(false, `bucket ${BUCKET}`, 'missing — run the migration')
  } else {
    if (meta?.public === true) {
      line(false, `bucket ${BUCKET}`, 'exists but is PUBLIC — it must stay private')
    } else {
      line(
        true,
        `bucket ${BUCKET}`,
        meta?.public === false
          ? 'exists and is private'
          : `exists; metadata hidden by RLS (HTTP ${detail.status})`,
      )
    }

    const list = await fetch(`${url}/storage/v1/object/list/${BUCKET}`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix: '', limit: 1 }),
      signal: timeout,
    })
    const objects = await readJson(list)
    if (Array.isArray(objects) && objects.length > 0) {
      line(false, `bucket ${BUCKET} policies`, `anonymous list returned ${objects.length} object(s)`)
    } else if (list.ok) {
      line(true, `bucket ${BUCKET} policies`, 'anonymous listing is empty')
    } else {
      line(true, `bucket ${BUCKET} policies`, `anonymous listing denied (HTTP ${list.status})`)
    }
  }
} catch (error) {
  line(false, `bucket ${BUCKET}`, error.message)
}

console.log(failed ? '\nCloud is not ready yet.' : '\nCloud is ready.')
process.exit(failed ? 1 : 0)
