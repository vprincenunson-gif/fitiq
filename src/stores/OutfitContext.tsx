import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { GarmentCategory, Outfit, OutfitComposition } from '../lib/types'
import { useWardrobe } from './WardrobeContext'

const OUTFIT_KEY = 'fitiq.outfit.current'
const SAVED_KEY = 'fitiq.outfits.saved'

interface OutfitContextValue {
  currentOutfit: OutfitComposition
  savedOutfits: Outfit[]
  addToOutfit: (garment: { id: string; category: GarmentCategory }) => void
  removeFromOutfit: (category: GarmentCategory) => void
  clearOutfit: () => void
  saveOutfit: (name: string) => void
  loadOutfit: (outfit: Outfit) => void
}

const OutfitContext = createContext<OutfitContextValue | null>(null)

export const emptyOutfit: OutfitComposition = {
  top: null,
  bottom: null,
  shoes: null,
}

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

/** Must be mounted inside WardrobeProvider (resolves ids → garments). */
export function OutfitProvider({ children }: { children: ReactNode }) {
  const { garmentById } = useWardrobe()

  const [currentIds, setCurrentIds] = useState<
    Partial<Record<GarmentCategory, string>>
  >(() => readJSON(OUTFIT_KEY, {}))

  const [savedOutfits, setSavedOutfits] = useState<Outfit[]>(() =>
    readJSON(SAVED_KEY, []),
  )

  useEffect(() => {
    try {
      localStorage.setItem(OUTFIT_KEY, JSON.stringify(currentIds))
    } catch {
      /* ignore */
    }
  }, [currentIds])

  useEffect(() => {
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify(savedOutfits))
    } catch {
      /* ignore */
    }
  }, [savedOutfits])

  const currentOutfit = useMemo<OutfitComposition>(() => {
    const top = currentIds.shirt ? garmentById(currentIds.shirt) : undefined
    const bottom = currentIds.pants ? garmentById(currentIds.pants) : undefined
    const shoes = currentIds.shoes ? garmentById(currentIds.shoes) : undefined
    return { top: top ?? null, bottom: bottom ?? null, shoes: shoes ?? null }
  }, [currentIds, garmentById])

  const addToOutfit = useCallback((garment: { id: string; category: GarmentCategory }) => {
    setCurrentIds((prev) => ({ ...prev, [garment.category]: garment.id }))
  }, [])

  const removeFromOutfit = useCallback((category: GarmentCategory) => {
    setCurrentIds((prev) => {
      const next = { ...prev }
      delete next[category]
      return next
    })
  }, [])

  const clearOutfit = useCallback(() => setCurrentIds({}), [])

  const saveOutfit = useCallback(
    (name: string) => {
      // Canonical order so loadOutfit can map by index: [top, bottom, shoes].
      const order: GarmentCategory[] = ['shirt', 'pants', 'shoes']
      const ids = order
        .map((cat) => currentIds[cat])
        .filter((id): id is string => Boolean(id))
      if (ids.length === 0) return
      const outfit: Outfit = {
        id: `outfit_${crypto.randomUUID()}`,
        name,
        garmentIds: ids,
        createdAt: new Date().toISOString(),
      }
      setSavedOutfits((prev) => [outfit, ...prev])
    },
    [currentIds],
  )

  const loadOutfit = useCallback((outfit: Outfit) => {
    const map: Partial<Record<GarmentCategory, string>> = {}
    const order: GarmentCategory[] = ['shirt', 'pants', 'shoes']
    order.forEach((cat, i) => {
      const id = outfit.garmentIds[i]
      if (id) map[cat] = id
    })
    setCurrentIds(map)
  }, [])

  const value = useMemo<OutfitContextValue>(
    () => ({
      currentOutfit,
      savedOutfits,
      addToOutfit,
      removeFromOutfit,
      clearOutfit,
      saveOutfit,
      loadOutfit,
    }),
    [
      currentOutfit,
      savedOutfits,
      addToOutfit,
      removeFromOutfit,
      clearOutfit,
      saveOutfit,
      loadOutfit,
    ],
  )

  return <OutfitContext.Provider value={value}>{children}</OutfitContext.Provider>
}

export function useOutfit(): OutfitContextValue {
  const ctx = useContext(OutfitContext)
  if (!ctx) throw new Error('useOutfit must be used within OutfitProvider')
  return ctx
}
