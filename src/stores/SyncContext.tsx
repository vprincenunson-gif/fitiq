import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import type { Garment, Outfit, OutfitSlotKey, StyleProfile } from '../lib/types'
import { EMPTY_STYLE_PROFILE } from '../lib/types'
import type { WearLogEntry } from './WearContext'
import type { PlannerPlan } from './PlannerContext'
import { useAuth } from './AuthContext'
import { useWardrobe } from './WardrobeContext'
import { useWear } from './WearContext'
import { useOutfit } from './OutfitContext'
import { usePlanner } from './PlannerContext'
import { useStyleProfile } from './StyleProfileContext'
import { useOutfitHistory } from './OutfitHistoryContext'
import type { HistoryEntry } from './OutfitHistoryContext'
import { useOnlineStatus } from '../lib/online'
import {
  fetchCloudSnapshot,
  mapCloudError,
  pushCloudSnapshot,
} from '../services/cloud'
import type { CloudErrorCode, CloudSnapshot } from '../services/cloud'
import {
  EMPTY_TOMBSTONES,
  applyGarmentTombstones,
  applyOutfitTombstones,
  applyPlanTombstones,
  diffRemovals,
  mergeGarments,
  mergeOutfits,
  mergePlan,
  mergeStyleProfile,
  mergeTombstones,
  mergeWearLog,
  pruneTombstones,
} from '../lib/syncMerge'
import type { SyncTombstones } from '../lib/syncMerge'
import {
  LOCAL_KEYS,
  backupGuestSnapshotOnce,
  getLocalOwner,
  readGuestSnapshot,
  readLastSyncedAt,
  readTombstones,
  setLocalOwner,
  writeLastSyncedAt,
  writeTombstones,
} from '../services/localCache'

/* ────────────────────────────────────────────────────────────────────────
   Cloud sync orchestration.

   Guest mode never touches the network. After sign-in:
     1. the guest's local data is backed up once (nothing is deleted),
     2. cloud data is pulled and merged by stable id (no duplicates),
     3. the merged result is pushed back and hydrated into the stores,
     4. later local edits are debounced and pushed; deletions are recorded
        as tombstones so they propagate without resurrecting rows.

   Account switching never merges one account's cache into another: the
   stores are cleared before the new account's cloud data is pulled.
   ──────────────────────────────────────────────────────────────────────── */

export type SyncState = 'guest' | 'idle' | 'syncing' | 'offline' | 'error'

export interface SyncContextValue {
  state: SyncState
  error: string | null
  errorCode: CloudErrorCode | null
  lastSyncedAt: string | null
  online: boolean
  cloudAvailable: boolean
  /** True once the current account's first pull/merge completed. */
  ready: boolean
  retry: () => void
}

const SyncContext = createContext<SyncContextValue | null>(null)

const emptySnapshot = (): CloudSnapshot => ({
  garments: [],
  wearLog: [],
  outfits: [],
  plan: {},
  profile: { ...EMPTY_STYLE_PROFILE },
})

interface IdSets {
  garments: Set<string>
  outfits: Set<string>
  planner: Set<string>
}

const emptySets = (): IdSets => ({
  garments: new Set(),
  outfits: new Set(),
  planner: new Set(),
})

const idSets = (snapshot: CloudSnapshot): IdSets => ({
  garments: new Set(snapshot.garments.map((garment) => garment.id)),
  outfits: new Set(snapshot.outfits.map((outfit) => outfit.id)),
  planner: new Set(Object.keys(snapshot.plan)),
})

/** Compact, cheap fingerprint used to skip no-op pushes. */
function signature(snapshot: CloudSnapshot): string {
  return JSON.stringify([
    snapshot.garments
      .map((g) => [g.id, g.updatedAt, g.wearStatus, g.wearCount, g.lastWornAt, g.favorite, g.photoPath])
      .sort(),
    snapshot.wearLog.map((entry) => entry.id).sort(),
    snapshot.outfits.map((o) => [o.id, o.updatedAt]).sort(),
    Object.entries(snapshot.plan)
      .map(([key, day]) => [key, day.outfitId, day.occasion, day.updatedAt])
      .sort(),
    [
      snapshot.profile.updatedAt,
      snapshot.profile.fit,
      snapshot.profile.favoriteColors,
      snapshot.profile.likes,
      snapshot.profile.avoids,
    ],
  ])
}

function mergeSnapshot(
  local: CloudSnapshot,
  remote: CloudSnapshot,
  tombstones: SyncTombstones,
): CloudSnapshot {
  return {
    garments: applyGarmentTombstones(mergeGarments(local.garments, remote.garments), tombstones),
    wearLog: mergeWearLog(local.wearLog, remote.wearLog),
    outfits: applyOutfitTombstones(mergeOutfits(local.outfits, remote.outfits), tombstones),
    plan: applyPlanTombstones(mergePlan(local.plan, remote.plan), tombstones),
    profile: mergeStyleProfile(local.profile, remote.profile),
  }
}

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function SyncProvider({ children }: { children: ReactNode }) {
  const { status, user, configured } = useAuth()
  const { garments, hydrateGarments } = useWardrobe()
  const { log, hydrateLog } = useWear()
  const { savedOutfits, hydrateSavedOutfits, hydrateCurrentOutfit } = useOutfit()
  const { plan, hydratePlan } = usePlanner()
  const { profile, hydrateProfile } = useStyleProfile()
  const { history, hydrateHistory } = useOutfitHistory()
  const online = useOnlineStatus()

  const [state, setState] = useState<SyncState>('guest')
  const [error, setError] = useState<string | null>(null)
  const [errorCode, setErrorCode] = useState<CloudErrorCode | null>(null)
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(() => readLastSyncedAt())
  const [ready, setReady] = useState(false)

  const latestRef = useRef<CloudSnapshot>({ ...emptySnapshot(), profile })
  latestRef.current = {
    garments,
    wearLog: log,
    outfits: savedOutfits,
    plan,
    profile,
  }

  const bootstrappingRef = useRef(false)
  const bootstrappedForRef = useRef<string | null>(null)
  const prevRef = useRef<IdSets>(emptySets())
  const tombstonesRef = useRef<SyncTombstones>(readTombstones())
  const pushTimerRef = useRef<number | null>(null)
  const lastSignatureRef = useRef<string>('')
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (pushTimerRef.current != null) window.clearTimeout(pushTimerRef.current)
    }
  }, [])

  const hydrateAll = useCallback(
    (snapshot: CloudSnapshot) => {
      hydrateGarments(snapshot.garments)
      hydrateLog(snapshot.wearLog)
      hydrateSavedOutfits(snapshot.outfits)
      hydratePlan(snapshot.plan)
      hydrateProfile(snapshot.profile)
    },
    [hydrateGarments, hydrateLog, hydrateSavedOutfits, hydratePlan, hydrateProfile],
  )

  const rememberSnapshot = useCallback((snapshot: CloudSnapshot) => {
    lastSignatureRef.current = signature(snapshot)
    prevRef.current = idSets(snapshot)
  }, [])

  const restoreGuest = useCallback(() => {
    const raw = readGuestSnapshot()
    const snapshot: CloudSnapshot = raw
      ? {
          garments: parseJson<Garment[]>(raw[LOCAL_KEYS.wardrobe], []),
          wearLog: parseJson<WearLogEntry[]>(raw[LOCAL_KEYS.wearLog], []),
          outfits: parseJson<Outfit[]>(raw[LOCAL_KEYS.savedOutfits], []),
          plan: parseJson<PlannerPlan>(raw[LOCAL_KEYS.planner], {}),
          profile: parseJson<StyleProfile>(raw[LOCAL_KEYS.styleProfile], {
            ...EMPTY_STYLE_PROFILE,
          }),
        }
      : emptySnapshot()

    hydrateAll(snapshot)
    hydrateCurrentOutfit(
      raw
        ? parseJson<Partial<Record<OutfitSlotKey, string>>>(raw[LOCAL_KEYS.outfitCurrent], {})
        : {},
    )
    hydrateHistory(raw ? parseJson<HistoryEntry[]>(raw[LOCAL_KEYS.outfitHistory], []) : [])
    rememberSnapshot(snapshot)

    setLocalOwner('guest')
    tombstonesRef.current = EMPTY_TOMBSTONES
    writeTombstones(EMPTY_TOMBSTONES)
    setLastSyncedAt(null)
    bootstrappedForRef.current = null
    setReady(false)
    setState('guest')
    setError(null)
    setErrorCode(null)
  }, [hydrateAll, hydrateCurrentOutfit, hydrateHistory, rememberSnapshot])

  const bootstrap = useCallback(
    async (userId: string) => {
      if (bootstrappingRef.current) return
      bootstrappingRef.current = true
      if (mountedRef.current) {
        setState('syncing')
        setError(null)
        setErrorCode(null)
      }

      const owner = getLocalOwner()
      const sameUser = owner === userId
      const guest = owner === 'guest'

      try {
        if (guest) backupGuestSnapshotOnce()

        // Account switch: never show or merge the previous account's cache.
        if (!sameUser && !guest) {
          const empty = emptySnapshot()
          hydrateAll(empty)
          hydrateCurrentOutfit({})
          hydrateHistory([])
          tombstonesRef.current = EMPTY_TOMBSTONES
          writeTombstones(EMPTY_TOMBSTONES)
          rememberSnapshot(empty)
        }

        const remote = await fetchCloudSnapshot(userId)
        // Read local state *after* the pull so edits made while it was in
        // flight still take part in the merge instead of being overwritten.
        const local = guest || sameUser ? latestRef.current : emptySnapshot()
        const merged = mergeSnapshot(local, remote, tombstonesRef.current)
        const pushed = await pushCloudSnapshot(userId, merged, tombstonesRef.current)
        const finalSnapshot: CloudSnapshot = { ...merged, garments: pushed.garments }

        hydrateAll(finalSnapshot)
        rememberSnapshot(finalSnapshot)

        tombstonesRef.current = pruneTombstones(tombstonesRef.current)
        writeTombstones(tombstonesRef.current)
        setLocalOwner(userId)

        const now = new Date().toISOString()
        setLastSyncedAt(now)
        writeLastSyncedAt(now)
        bootstrappedForRef.current = userId
        if (mountedRef.current) {
          setReady(true)
          setState('idle')
        }
      } catch (err) {
        const mapped = mapCloudError(err)
        if (mountedRef.current) {
          setError(mapped.message)
          setErrorCode(mapped.code)
          setState(mapped.code === 'offline' ? 'offline' : 'error')
        }
      } finally {
        bootstrappingRef.current = false
      }
    },
    [hydrateAll, hydrateCurrentOutfit, hydrateHistory, rememberSnapshot],
  )

  const schedulePush = useCallback(() => {
    if (pushTimerRef.current != null) window.clearTimeout(pushTimerRef.current)
    pushTimerRef.current = window.setTimeout(() => {
      pushTimerRef.current = null
      void (async () => {
        if (!user || bootstrappingRef.current) return
        if (!online) {
          if (mountedRef.current) setState('offline')
          return
        }
        if (mountedRef.current) setState('syncing')
        try {
          const result = await pushCloudSnapshot(user.id, latestRef.current, tombstonesRef.current)
          const changedPhoto = result.garments.some((garment) => {
            const current = latestRef.current.garments.find((item) => item.id === garment.id)
            return Boolean(garment.photoPath) && garment.photoPath !== current?.photoPath
          })
          const finalSnapshot: CloudSnapshot = {
            ...latestRef.current,
            garments: result.garments,
          }
          if (changedPhoto) {
            hydrateGarments(result.garments)
          }
          rememberSnapshot(finalSnapshot)
          if (mountedRef.current) {
            const now = new Date().toISOString()
            setLastSyncedAt(now)
            writeLastSyncedAt(now)
            setState('idle')
            setError(null)
            setErrorCode(null)
          }
        } catch (err) {
          const mapped = mapCloudError(err)
          if (mountedRef.current) {
            setError(mapped.message)
            setErrorCode(mapped.code)
            setState(mapped.code === 'offline' ? 'offline' : 'error')
          }
        }
      })()
    }, 900)
  }, [user, online, hydrateGarments, rememberSnapshot])

  // Account lifecycle: bootstrap on sign-in, restore guest data on sign-out.
  useEffect(() => {
    if (status === 'loading') return

    if (!user) {
      const owner = getLocalOwner()
      if (owner !== 'guest' || bootstrappedForRef.current) restoreGuest()
      else setState('guest')
      return
    }

    if (!online) {
      setState('offline')
      return
    }

    void bootstrap(user.id)
    // `bootstrap` is stable; user/online drive this lifecycle effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, status, online, restoreGuest, bootstrap])

  // Debounced push after real local edits.
  useEffect(() => {
    if (status !== 'authenticated' || !user) return
    if (bootstrappedForRef.current !== user.id) return

    const current = latestRef.current
    const currentSignature = signature(current)
    if (currentSignature === lastSignatureRef.current) return
    lastSignatureRef.current = currentSignature

    const now = new Date().toISOString()
    const removed = {
      garments: diffRemovals(prevRef.current.garments, current.garments.map((g) => g.id), now),
      outfits: diffRemovals(prevRef.current.outfits, current.outfits.map((o) => o.id), now),
      planner: diffRemovals(prevRef.current.planner, Object.keys(current.plan), now),
    }
    prevRef.current = idSets(current)

    const nextTombstones = pruneTombstones(mergeTombstones(tombstonesRef.current, removed))
    tombstonesRef.current = nextTombstones
    writeTombstones(nextTombstones)

    schedulePush()
  }, [
    garments,
    log,
    savedOutfits,
    plan,
    profile,
    history,
    user,
    status,
    schedulePush,
  ])

  const retry = useCallback(() => {
    if (!user) return
    if (!online) {
      setState('offline')
      return
    }
    void bootstrap(user.id)
  }, [user, online, bootstrap])

  const value = useMemo<SyncContextValue>(
    () => ({
      state,
      error,
      errorCode,
      lastSyncedAt,
      online,
      cloudAvailable: configured,
      ready,
      retry,
    }),
    [state, error, errorCode, lastSyncedAt, online, configured, ready, retry],
  )

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>
}

export function useSync(): SyncContextValue {
  const ctx = useContext(SyncContext)
  if (!ctx) throw new Error('useSync must be used within SyncProvider')
  return ctx
}
