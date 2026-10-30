import type { SyncTombstones } from '../lib/syncMerge'
import { EMPTY_TOMBSTONES } from '../lib/syncMerge'

/* ────────────────────────────────────────────────────────────────────────
   Raw localStorage helpers used only around sign-in / sign-out transitions.

   Contexts own the live state and keep writing their usual keys; this module
   snapshots the guest's keys before the first migration, restores them on
   sign-out, and remembers which account the local cache belongs to.
   ──────────────────────────────────────────────────────────────────────── */

export const LOCAL_KEYS = {
  wardrobe: 'fitiq.wardrobe.v2',
  wearLog: 'fitiq.wear.log.v1',
  outfitCurrent: 'fitiq.outfit.current',
  savedOutfits: 'fitiq.outfits.saved',
  planner: 'fitiq.planner.v1',
  styleProfile: 'fitiq.style-profile.v1',
  outfitHistory: 'fitiq.outfit.history.v1',
  owner: 'fitiq.sync.owner.v1',
  guestSnapshot: 'fitiq.guest.snapshot.v1',
  tombstones: 'fitiq.sync.tombstones.v1',
  lastSyncedAt: 'fitiq.sync.last-synced.v1',
} as const

export type LocalOwner = 'guest' | string

export function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeRaw(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* storage unavailable / quota */
  }
}

export function removeRaw(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    /* storage unavailable */
  }
}

/** A byte-for-byte copy of the guest keys, so sign-out can restore them. */
export type RawSnapshot = Record<string, string | null>

const SNAPSHOT_KEYS = [
  LOCAL_KEYS.wardrobe,
  LOCAL_KEYS.wearLog,
  LOCAL_KEYS.outfitCurrent,
  LOCAL_KEYS.savedOutfits,
  LOCAL_KEYS.planner,
  LOCAL_KEYS.styleProfile,
  LOCAL_KEYS.outfitHistory,
] as const

export function captureRawSnapshot(): RawSnapshot {
  const snapshot: RawSnapshot = {}
  for (const key of SNAPSHOT_KEYS) snapshot[key] = readRaw(key)
  return snapshot
}

export function restoreRawSnapshot(snapshot: RawSnapshot): void {
  for (const key of SNAPSHOT_KEYS) {
    const value = snapshot[key]
    if (typeof value === 'string') writeRaw(key, value)
    else removeRaw(key)
  }
}

export function hasGuestSnapshot(): boolean {
  return readRaw(LOCAL_KEYS.guestSnapshot) != null
}

/**
 * Before the first sign-in, preserve the guest's local data. The snapshot is
 * written once and never overwritten, so later accounts cannot clobber it.
 */
export function backupGuestSnapshotOnce(): void {
  if (hasGuestSnapshot()) return
  writeRaw(LOCAL_KEYS.guestSnapshot, JSON.stringify(captureRawSnapshot()))
}

export function readGuestSnapshot(): RawSnapshot | null {
  const raw = readRaw(LOCAL_KEYS.guestSnapshot)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as RawSnapshot
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

export function getLocalOwner(): LocalOwner {
  return readRaw(LOCAL_KEYS.owner) ?? 'guest'
}

export function setLocalOwner(owner: LocalOwner): void {
  writeRaw(LOCAL_KEYS.owner, owner)
}

export function readTombstones(): SyncTombstones {
  const raw = readRaw(LOCAL_KEYS.tombstones)
  if (!raw) return EMPTY_TOMBSTONES
  try {
    const parsed = JSON.parse(raw) as Partial<SyncTombstones>
    return {
      garments: parsed.garments ?? {},
      outfits: parsed.outfits ?? {},
      planner: parsed.planner ?? {},
    }
  } catch {
    return EMPTY_TOMBSTONES
  }
}

export function writeTombstones(tombstones: SyncTombstones): void {
  writeRaw(LOCAL_KEYS.tombstones, JSON.stringify(tombstones))
}

export function readLastSyncedAt(): string | null {
  return readRaw(LOCAL_KEYS.lastSyncedAt)
}

export function writeLastSyncedAt(at: string): void {
  writeRaw(LOCAL_KEYS.lastSyncedAt, at)
}
