import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { EMPTY_STYLE_PROFILE, type StyleProfile } from '../lib/types'

const PROFILE_KEY = 'fitiq.style-profile.v1'

interface StyleProfileContextValue {
  profile: StyleProfile
  updateProfile: (patch: Partial<StyleProfile>) => void
  resetProfile: () => void
}

const StyleProfileContext = createContext<StyleProfileContextValue | null>(null)

function readProfile(): StyleProfile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    if (!raw) return EMPTY_STYLE_PROFILE
    const parsed = JSON.parse(raw) as Partial<StyleProfile>
    return {
      fit: parsed.fit ?? EMPTY_STYLE_PROFILE.fit,
      favoriteColors: Array.isArray(parsed.favoriteColors) ? parsed.favoriteColors : [],
      likes: Array.isArray(parsed.likes) ? parsed.likes : [],
      avoids: Array.isArray(parsed.avoids) ? parsed.avoids : [],
    }
  } catch {
    return EMPTY_STYLE_PROFILE
  }
}

export function StyleProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<StyleProfile>(readProfile)

  useEffect(() => {
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
    } catch {
      /* storage unavailable */
    }
  }, [profile])

  const updateProfile = useCallback((patch: Partial<StyleProfile>) => {
    setProfile((prev) => ({ ...prev, ...patch }))
  }, [])

  const resetProfile = useCallback(() => setProfile(EMPTY_STYLE_PROFILE), [])

  const value = useMemo(
    () => ({ profile, updateProfile, resetProfile }),
    [profile, updateProfile, resetProfile],
  )

  return <StyleProfileContext.Provider value={value}>{children}</StyleProfileContext.Provider>
}

export function useStyleProfile(): StyleProfileContextValue {
  const ctx = useContext(StyleProfileContext)
  if (!ctx) throw new Error('useStyleProfile must be used within StyleProfileProvider')
  return ctx
}
