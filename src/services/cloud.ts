import type { Garment, Outfit, StyleProfile } from '../lib/types'
import { EMPTY_STYLE_PROFILE } from '../lib/types'
import type { WearLogEntry } from '../stores/WearContext'
import type { PlannerPlan } from '../stores/PlannerContext'
import { requireSupabase, supabaseConfig } from '../lib/supabase'
import type { SyncTombstones } from '../lib/syncMerge'
import {
  CLOUD_TABLES,
  PHOTO_BUCKET,
  SIGNED_URL_TTL_SECONDS,
  garmentToRow,
  outfitToRow,
  planToRows,
  rowToGarment,
  rowToOutfit,
  rowToStyle,
  rowToWear,
  rowsToPlan,
  styleToRow,
  wearToRow,
} from './cloudMappers'
import type {
  OutfitRow,
  PlannerRow,
  StyleRow,
  WardrobeRow,
  WearRow,
} from './cloudMappers'

/* ────────────────────────────────────────────────────────────────────────
   Supabase data + storage access.

   Every query is scoped to the signed-in user and is additionally guarded by
   Row Level Security in Postgres. Photos go to a private bucket under the
   user's own folder; the app reads them back through short-lived signed URLs.
   ──────────────────────────────────────────────────────────────────────── */

export type CloudErrorCode =
  | 'not-configured'
  | 'offline'
  | 'schema-missing'
  | 'storage-missing'
  | 'auth'
  | 'permission'
  | 'network'
  | 'unknown'

export class CloudError extends Error {
  readonly code: CloudErrorCode

  constructor(code: CloudErrorCode, message: string) {
    super(message)
    this.name = 'CloudError'
    this.code = code
  }
}

interface SupabaseLikeError {
  message?: string
  code?: string
  status?: number
  name?: string
}

const text = (error: unknown): string => {
  const e = error as SupabaseLikeError | null
  return `${e?.message ?? ''}`.toLowerCase()
}

export function mapCloudError(error: unknown): CloudError {
  if (error instanceof CloudError) return error
  const e = (error ?? {}) as SupabaseLikeError
  const message = text(error)
  const code = e.code ?? ''

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return new CloudError('offline', 'You are offline. Changes are saved on this device.')
  }
  if (
    code === 'PGRST205' ||
    code === '42P01' ||
    code === 'PGRST204' ||
    message.includes('could not find the table') ||
    message.includes('does not exist')
  ) {
    return new CloudError(
      'schema-missing',
      'Cloud tables are not set up yet. Run the FITIQ Supabase migration once.',
    )
  }
  if (message.includes('bucket not found') || code === '404') {
    return new CloudError(
      'storage-missing',
      'The private photo bucket is missing. Run the FITIQ Supabase migration once.',
    )
  }
  if (code === '42501' || message.includes('row-level security') || message.includes('permission denied')) {
    return new CloudError('permission', 'This account is not allowed to access that data.')
  }
  if (e.status === 401 || code === 'PGRST301' || message.includes('jwt')) {
    return new CloudError('auth', 'Your session expired. Sign in again to resume sync.')
  }
  if (
    e.name === 'TypeError' ||
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('network request failed')
  ) {
    return new CloudError('network', 'Cloud sync could not reach Supabase. We will retry.')
  }
  return new CloudError('unknown', e.message?.trim() || 'Cloud sync failed. We will retry.')
}

export function friendlyCloudError(error: unknown): string {
  return mapCloudError(error).message
}

export interface CloudSnapshot {
  garments: Garment[]
  wearLog: WearLogEntry[]
  outfits: Outfit[]
  plan: PlannerPlan
  profile: StyleProfile
}

export interface PushResult {
  /** Garments with the Storage path attached after any photo upload. */
  garments: Garment[]
}

function assertOnline(): void {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new CloudError('offline', 'You are offline. Changes are saved on this device.')
  }
}

function assertConfigured() {
  if (!supabaseConfig.configured) {
    throw new CloudError('not-configured', supabaseConfig.reason ?? 'Supabase is not configured.')
  }
  return requireSupabase()
}

function fail(error: unknown): never {
  throw mapCloudError(error)
}

export async function fetchCloudSnapshot(userId: string): Promise<CloudSnapshot> {
  assertOnline()
  const client = assertConfigured()

  const [wardrobe, wear, outfits, planner, style] = await Promise.all([
    client.from(CLOUD_TABLES.wardrobe).select('*').eq('user_id', userId),
    client.from(CLOUD_TABLES.wearLog).select('*').eq('user_id', userId),
    client.from(CLOUD_TABLES.outfits).select('*').eq('user_id', userId),
    client.from(CLOUD_TABLES.planner).select('*').eq('user_id', userId),
    client.from(CLOUD_TABLES.style).select('*').eq('user_id', userId).maybeSingle(),
  ])

  for (const result of [wardrobe, wear, outfits, planner, style]) {
    if (result.error) fail(result.error)
  }

  const wardrobeRows = (wardrobe.data ?? []) as WardrobeRow[]
  const signedUrls = await createSignedUrls(
    wardrobeRows.map((row) => row.photo_path).filter((path): path is string => Boolean(path)),
  )

  return {
    garments: wardrobeRows.map((row) =>
      rowToGarment(row, row.photo_path ? signedUrls[row.photo_path] ?? null : null),
    ),
    wearLog: ((wear.data ?? []) as WearRow[]).map(rowToWear),
    outfits: ((outfits.data ?? []) as OutfitRow[]).map(rowToOutfit),
    plan: rowsToPlan((planner.data ?? []) as PlannerRow[]),
    profile: style.data ? rowToStyle(style.data as StyleRow) : { ...EMPTY_STYLE_PROFILE },
  }
}

async function createSignedUrls(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {}
  const client = assertConfigured()
  const unique = [...new Set(paths)]
  const { data, error } = await client.storage
    .from(PHOTO_BUCKET)
    .createSignedUrls(unique, SIGNED_URL_TTL_SECONDS)

  if (error) {
    // Photos failing to sign must not block metadata sync.
    console.warn('[FITIQ] could not sign wardrobe photo URLs', error.message)
    return {}
  }

  const urls: Record<string, string> = {}
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) urls[item.path] = item.signedUrl
  }
  return urls
}

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
}

export async function uploadGarmentPhoto(userId: string, garment: Garment): Promise<string> {
  const client = assertConfigured()
  const dataUrl = garment.image
  if (!dataUrl.startsWith('data:image/')) {
    throw new CloudError('unknown', 'Only captured photos can be uploaded.')
  }

  const match = /^data:(image\/[a-z0-9.+-]+);base64,/i.exec(dataUrl)
  const contentType = match?.[1]?.toLowerCase() ?? 'image/jpeg'
  const extension = EXTENSIONS[contentType] ?? 'jpg'
  const blob = await fetch(dataUrl).then((response) => response.blob())
  const path = `${userId}/${garment.id}.${extension}`

  const { error } = await client.storage.from(PHOTO_BUCKET).upload(path, blob, {
    contentType,
    upsert: true,
    cacheControl: '3600',
  })
  if (error) fail(error)
  return path
}

async function uploadMissingPhotos(
  userId: string,
  garments: Garment[],
): Promise<Garment[]> {
  const result: Garment[] = []
  for (const garment of garments) {
    if (garment.photoPath || !garment.image.startsWith('data:image/')) {
      result.push(garment)
      continue
    }
    try {
      const photoPath = await uploadGarmentPhoto(userId, garment)
      result.push({ ...garment, photoPath })
    } catch (error) {
      const mapped = mapCloudError(error)
      // A missing bucket should be surfaced; other photo failures must not
      // discard the metadata. The row keeps its local photo until retry.
      if (mapped.code === 'storage-missing' || mapped.code === 'permission') throw mapped
      console.warn('[FITIQ] photo upload failed; metadata will still sync', mapped.code)
      result.push(garment)
    }
  }
  return result
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size))
  return chunks
}

export async function pushCloudSnapshot(
  userId: string,
  snapshot: CloudSnapshot,
  tombstones: SyncTombstones,
  now: string = new Date().toISOString(),
): Promise<PushResult> {
  assertOnline()
  const client = assertConfigured()

  // 1. Upload original captures first, so rows only ever reference real objects.
  const garments = await uploadMissingPhotos(userId, snapshot.garments)

  // 2. Metadata upserts.
  const wardrobeRows = garments.map((garment) =>
    garmentToRow(garment, userId, garment.photoPath ?? null, now),
  )
  for (const rows of chunk(wardrobeRows, 100)) {
    const { error } = await client
      .from(CLOUD_TABLES.wardrobe)
      .upsert(rows, { onConflict: 'id' })
    if (error) fail(error)
  }

  const wearRows = snapshot.wearLog.map((entry) => wearToRow(entry, userId, now))
  for (const rows of chunk(wearRows, 100)) {
    const { error } = await client.from(CLOUD_TABLES.wearLog).upsert(rows, { onConflict: 'id' })
    if (error) fail(error)
  }

  const outfitRows = snapshot.outfits.map((outfit) => outfitToRow(outfit, userId, now))
  for (const rows of chunk(outfitRows, 100)) {
    const { error } = await client
      .from(CLOUD_TABLES.outfits)
      .upsert(rows, { onConflict: 'id' })
    if (error) fail(error)
  }

  const plannerRows = planToRows(snapshot.plan, userId, now)
  for (const rows of chunk(plannerRows, 100)) {
    const { error } = await client
      .from(CLOUD_TABLES.planner)
      .upsert(rows, { onConflict: 'user_id,date_key' })
    if (error) fail(error)
  }

  if (snapshot.profile) {
    const { error } = await client
      .from(CLOUD_TABLES.style)
      .upsert(styleToRow(snapshot.profile, userId, now), { onConflict: 'user_id' })
    if (error) fail(error)
  }

  // 3. Propagate deletions recorded as tombstones.
  await deleteTombstoned(client, userId, tombstones)

  return { garments }
}

async function deleteTombstoned(
  client: ReturnType<typeof requireSupabase>,
  userId: string,
  tombstones: SyncTombstones,
): Promise<void> {
  const garmentIds = Object.keys(tombstones.garments)
  if (garmentIds.length > 0) {
    // Best-effort photo cleanup before removing the rows.
    const { data: photos } = await client
      .from(CLOUD_TABLES.wardrobe)
      .select('photo_path')
      .eq('user_id', userId)
      .in('id', garmentIds)
    const paths = ((photos ?? []) as { photo_path: string | null }[])
      .map((row) => row.photo_path)
      .filter((path): path is string => Boolean(path))
    if (paths.length > 0) {
      const { error: storageError } = await client.storage.from(PHOTO_BUCKET).remove(paths)
      if (storageError) console.warn('[FITIQ] could not delete photos', storageError.message)
    }
    const { error } = await client
      .from(CLOUD_TABLES.wardrobe)
      .delete()
      .eq('user_id', userId)
      .in('id', garmentIds)
    if (error) fail(error)
  }

  const outfitIds = Object.keys(tombstones.outfits)
  if (outfitIds.length > 0) {
    const { error } = await client
      .from(CLOUD_TABLES.outfits)
      .delete()
      .eq('user_id', userId)
      .in('id', outfitIds)
    if (error) fail(error)
  }

  const plannerKeys = Object.keys(tombstones.planner)
  if (plannerKeys.length > 0) {
    const { error } = await client
      .from(CLOUD_TABLES.planner)
      .delete()
      .eq('user_id', userId)
      .in('date_key', plannerKeys)
    if (error) fail(error)
  }
}
