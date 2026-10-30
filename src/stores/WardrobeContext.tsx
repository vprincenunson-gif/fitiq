import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Garment } from '../lib/types'
import { DEFAULT_WEAR_STATUS, WEAR_STATUS_VALUES } from '../lib/types'
import { MOCK_WARDROBE } from '../data/mockWardrobe'

// v2: previous versions seeded demo items under the v1 key — bump so a
// fresh install (and any install with only seed data) starts empty.
const STORAGE_KEY = 'fitiq.wardrobe.v2'

interface WardrobeContextValue {
  garments: Garment[]
  ready: boolean
  addGarment: (garment: Garment) => void
  updateGarment: (id: string, patch: Partial<Garment>) => void
  removeGarment: (id: string) => void
  toggleFavorite: (id: string) => void
  garmentById: (id: string) => Garment | undefined
}

const WardrobeContext = createContext<WardrobeContextValue | null>(null)

function loadInitial(): { garments: Garment[]; ready: boolean } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Garment[]
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Backfill wear status for items stored before the feature existed,
        // and repair any corrupted values, so persistence stays clean.
        for (const g of parsed) {
          if (!g.wearStatus || !WEAR_STATUS_VALUES.includes(g.wearStatus)) {
            g.wearStatus = DEFAULT_WEAR_STATUS
          }
          // Drop corrupted wear-tracking values so counts stay trustworthy.
          if (typeof g.wearCount !== 'number' || !Number.isFinite(g.wearCount) || g.wearCount < 0) {
            delete g.wearCount
          }
          if (
            g.lastWornAt !== undefined &&
            g.lastWornAt !== null &&
            (typeof g.lastWornAt !== 'string' || Number.isNaN(Date.parse(g.lastWornAt)))
          ) {
            delete g.lastWornAt
          }
        }
        return { garments: parsed, ready: true }
      }
    }
  } catch {
    /* corrupted storage — fall through to seed */
  }
  return { garments: MOCK_WARDROBE, ready: false }
}

export function WardrobeProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(loadInitial)
  const [garments, setGarments] = useState<Garment[]>(initial.garments)
  const [ready, setReady] = useState(initial.ready)

  useEffect(() => {
    if (!ready) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(garments))
      } catch {
        /* storage unavailable */
      }
      setReady(true)
    }
  }, [ready, garments])

  useEffect(() => {
    if (!ready) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(garments))
    } catch {
      /* storage unavailable */
    }
  }, [ready, garments])

  const addGarment = useCallback((garment: Garment) => {
    setGarments((prev) => [garment, ...prev])
  }, [])

  const updateGarment = useCallback((id: string, patch: Partial<Garment>) => {
    setGarments((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)))
  }, [])

  const removeGarment = useCallback((id: string) => {
    setGarments((prev) => prev.filter((g) => g.id !== id))
  }, [])

  const toggleFavorite = useCallback((id: string) => {
    setGarments((prev) =>
      prev.map((g) => (g.id === id ? { ...g, favorite: !g.favorite } : g)),
    )
  }, [])

  const garmentById = useCallback(
    (id: string) => garments.find((g) => g.id === id),
    [garments],
  )

  const value = useMemo(
    () => ({ garments, ready, addGarment, updateGarment, removeGarment, toggleFavorite, garmentById }),
    [garments, ready, addGarment, updateGarment, removeGarment, toggleFavorite, garmentById],
  )

  return <WardrobeContext.Provider value={value}>{children}</WardrobeContext.Provider>
}

export function useWardrobe(): WardrobeContextValue {
  const ctx = useContext(WardrobeContext)
  if (!ctx) throw new Error('useWardrobe must be used within WardrobeProvider')
  return ctx
}
