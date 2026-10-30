import type { Garment, Outfit, StyleProfile } from './types'

/* ────────────────────────────────────────────────────────────────────────
   Cloud merge rules — pure functions, no browser or network access.

   The merge is deliberately additive: local data is never discarded during
   a first sign-in. Entities are matched by their stable ids, so migrating a
   localStorage wardrobe into the cloud cannot create duplicates. When the
   same id exists on both sides, the newest `updatedAt` wins; ties fall back
   to the cloud copy (the signed-in user's canonical record).
   ──────────────────────────────────────────────────────────────────────── */

export interface SyncTombstones {
  garments: Record<string, string>
  outfits: Record<string, string>
  planner: Record<string, string>
}

export const EMPTY_TOMBSTONES: SyncTombstones = {
  garments: {},
  outfits: {},
  planner: {},
}

const timeOf = (value: string | null | undefined): number =>
  value && !Number.isNaN(Date.parse(value)) ? Date.parse(value) : 0

export function newerFirst<T extends { id: string; updatedAt?: string }>(
  local: T[],
  remote: T[],
): T[] {
  const merged = new Map<string, T>()
  for (const item of local) merged.set(item.id, item)
  for (const item of remote) {
    const existing = merged.get(item.id)
    // On equal timestamps the cloud copy is canonical.
    if (!existing || timeOf(item.updatedAt) >= timeOf(existing.updatedAt)) {
      merged.set(item.id, item)
    }
  }
  return [...merged.values()]
}

export function mergeGarments(local: Garment[], remote: Garment[]): Garment[] {
  return newerFirst(local, remote)
}

export function mergeOutfits(local: Outfit[], remote: Outfit[]): Outfit[] {
  const merged = newerFirst(local, remote)
  return merged.sort((a, b) => timeOf(b.createdAt) - timeOf(a.createdAt))
}

export interface WearEntryLike {
  id: string
  dateKey: string
  wornAt: string
  garmentIds: string[]
  outfitId: string | null
  source: 'planner' | 'saved'
}

/**
 * Wear entries are append-only. Match by id first, then by the semantic
 * identity used to prevent double-counting (day + saved look, or day + the
 * exact garment combination). This makes repeated migrations idempotent.
 */
export function mergeWearLog<T extends WearEntryLike>(
  local: T[],
  remote: T[],
  maxEntries = 200,
): T[] {
  // Local entries keep their ids and order; remote entries only fill gaps.
  const byId = new Map<string, T>()
  for (const entry of local) byId.set(entry.id, entry)
  for (const entry of remote) {
    if (!byId.has(entry.id)) byId.set(entry.id, entry)
  }

  const seen = new Set<string>()
  const merged: T[] = []
  for (const entry of byId.values()) {
    const identity = entry.outfitId
      ? `outfit:${entry.dateKey}:${entry.outfitId}`
      : `combo:${entry.dateKey}:${entry.garmentIds.join('|')}`
    if (seen.has(identity)) continue
    seen.add(identity)
    merged.push(entry)
  }

  return merged
    .sort((a, b) => timeOf(b.wornAt) - timeOf(a.wornAt) || a.id.localeCompare(b.id))
    .slice(0, maxEntries)
}

export interface PlannedDayLike {
  outfitId: string | null
  occasion: string | null
  updatedAt?: string
}

export function mergePlan<T extends PlannedDayLike>(
  local: Record<string, T>,
  remote: Record<string, T>,
): Record<string, T> {
  const merged: Record<string, T> = { ...local }
  for (const [key, remoteDay] of Object.entries(remote)) {
    const localDay = merged[key]
    // On equal timestamps the cloud copy is canonical.
    if (!localDay || timeOf(remoteDay.updatedAt) >= timeOf(localDay.updatedAt)) {
      merged[key] = remoteDay
    }
  }
  return merged
}

const unique = <T,>(values: T[]): T[] => [...new Set(values)]

export function mergeStyleProfile(
  local: StyleProfile,
  remote: StyleProfile | null,
): StyleProfile {
  if (!remote) return local
  const localTime = timeOf(local.updatedAt)
  const remoteTime = timeOf(remote.updatedAt)
  if (remoteTime > localTime) return remote
  if (localTime > remoteTime) return local

  // No usable timestamps: keep the union so a guest profile is not lost.
  return {
    fit: local.fit ?? remote.fit,
    favoriteColors: unique([...local.favoriteColors, ...remote.favoriteColors]),
    likes: unique([...local.likes, ...remote.likes]),
    avoids: unique([...local.avoids, ...remote.avoids]),
    updatedAt: local.updatedAt ?? remote.updatedAt,
  }
}

export function mergeTombstones(
  local: SyncTombstones,
  remote: SyncTombstones | null,
): SyncTombstones {
  if (!remote) return local
  const pick = (a: Record<string, string>, b: Record<string, string>) => {
    const merged = { ...b }
    for (const [key, at] of Object.entries(a)) {
      if (!merged[key] || timeOf(at) > timeOf(merged[key])) merged[key] = at
    }
    return merged
  }
  return {
    garments: pick(local.garments, remote.garments),
    outfits: pick(local.outfits, remote.outfits),
    planner: pick(local.planner, remote.planner),
  }
}

/** Deletions older than this are forgotten; they are only needed to converge devices. */
export const TOMBSTONE_TTL_DAYS = 45

export function pruneTombstones(
  tombstones: SyncTombstones,
  now: Date = new Date(),
): SyncTombstones {
  const cutoff = now.getTime() - TOMBSTONE_TTL_DAYS * 24 * 60 * 60 * 1000
  const prune = (record: Record<string, string>) =>
    Object.fromEntries(Object.entries(record).filter(([, at]) => timeOf(at) >= cutoff))
  return {
    garments: prune(tombstones.garments),
    outfits: prune(tombstones.outfits),
    planner: prune(tombstones.planner),
  }
}

/** True when a deletion should still hide an entity (no edit after deletion). */
export function isTombstoned(
  tombstoneAt: string | undefined,
  itemUpdatedAt: string | undefined,
): boolean {
  if (!tombstoneAt) return false
  if (!itemUpdatedAt) return true
  return timeOf(tombstoneAt) >= timeOf(itemUpdatedAt)
}

export function applyGarmentTombstones(
  garments: Garment[],
  tombstones: SyncTombstones,
): Garment[] {
  return garments.filter(
    (garment) => !isTombstoned(tombstones.garments[garment.id], garment.updatedAt),
  )
}

export function applyOutfitTombstones(
  outfits: Outfit[],
  tombstones: SyncTombstones,
): Outfit[] {
  return outfits.filter(
    (outfit) => !isTombstoned(tombstones.outfits[outfit.id], outfit.updatedAt),
  )
}

export function applyPlanTombstones<T extends PlannedDayLike>(
  plan: Record<string, T>,
  tombstones: SyncTombstones,
): Record<string, T> {
  return Object.fromEntries(
    Object.entries(plan).filter(
      ([key, day]) => !isTombstoned(tombstones.planner[key], day.updatedAt),
    ),
  )
}

/** Ids/keys that disappeared locally since the previous snapshot. */
export function diffRemovals(
  previous: Iterable<string>,
  next: Iterable<string>,
  now: string,
): Record<string, string> {
  const nextSet = new Set(next)
  const removed: Record<string, string> = {}
  for (const id of previous) {
    if (!nextSet.has(id)) removed[id] = now
  }
  return removed
}
