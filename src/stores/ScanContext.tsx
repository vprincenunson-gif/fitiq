import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { DetectedGarment } from '../lib/types'
import { genericGarmentName } from '../lib/types'
import { detectionService } from '../services'
import type { DetectionMode } from '../services/detection'

export type ScanPhase =
  | 'idle'
  | 'requesting'
  | 'live'
  | 'capturing'
  | 'consent'
  | 'detecting'
  | 'confirming'
  | 'error'

interface ScanContextValue {
  phase: ScanPhase
  error: string | null
  capturedDataUrl: string | null
  detected: DetectedGarment | null
  begin: () => void
  setLive: () => void
  captured: (dataUrl: string) => void
  requestConsent: () => void
  analyze: (mode: DetectionMode) => void
  rescan: () => void
  fail: (message: string) => void
  reset: () => void
}

const ScanContext = createContext<ScanContextValue | null>(null)

export function ScanProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<ScanPhase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null)
  const [detected, setDetected] = useState<DetectedGarment | null>(null)
  const detectRun = useRef(0)
  // Re-entry guard: a rapid double-click must not upload the same capture twice.
  const analyzing = useRef(false)

  const begin = useCallback(() => {
    setError(null)
    setPhase('requesting')
  }, [])
  const setLive = useCallback(() => setPhase('live'), [])

  const captured = useCallback((dataUrl: string) => {
    detectRun.current += 1
    setDetected(null)
    setCapturedDataUrl(dataUrl)
    setPhase('capturing')
  }, [])

  /** After the capture flash: pause for explicit photo-sharing consent. */
  const requestConsent = useCallback(() => {
    setDetected(null)
    setPhase('consent')
  }, [])

  /**
   * Analyse the capture. `vision` sends the photo to /api/detect-garment only
   * because the user just consented; any failure falls back to local analysis
   * inside detectionService. `local` never leaves the browser.
   */
  const analyze = useCallback((mode: DetectionMode) => {
    // Re-entry guard: a rapid double-click must not upload the same capture twice.
    if (analyzing.current) return
    const frame = capturedDataUrl ?? ''
    const run = ++detectRun.current
    analyzing.current = true
    setDetected(null)
    setPhase('detecting')

    void detectionService
      .detect(frame, { mode })
      .then((result) => {
        if (run !== detectRun.current) return // stale
        setDetected(result)
        setPhase('confirming')
      })
      .catch(() => {
        if (run !== detectRun.current) return
        // Both providers failed: keep the flow usable with editable generics.
        setDetected({
          category: 'shirt',
          color: 'oat',
          colorLabel: 'Neutral',
          name: genericGarmentName('Neutral', 'shirt'),
          styleTags: [],
          fit: 'regular',
          image: frame,
          source: 'local',
          fallback: mode === 'vision',
        })
        setPhase('confirming')
      })
      .finally(() => {
        analyzing.current = false
      })
  }, [capturedDataUrl])

  const rescan = useCallback(() => {
    detectRun.current += 1
    setDetected(null)
    setCapturedDataUrl(null)
    setPhase('live')
  }, [])

  const fail = useCallback((message: string) => {
    setError(message)
    setPhase('error')
  }, [])

  const reset = useCallback(() => {
    detectRun.current += 1
    setPhase('idle')
    setError(null)
    setCapturedDataUrl(null)
    setDetected(null)
  }, [])

  const value = useMemo<ScanContextValue>(
    () => ({
      phase,
      error,
      capturedDataUrl,
      detected,
      begin,
      setLive,
      captured,
      requestConsent,
      analyze,
      rescan,
      fail,
      reset,
    }),
    [phase, error, capturedDataUrl, detected, begin, setLive, captured, requestConsent, analyze, rescan, fail, reset],
  )

  return <ScanContext.Provider value={value}>{children}</ScanContext.Provider>
}

export function useScan(): ScanContextValue {
  const ctx = useContext(ScanContext)
  if (!ctx) throw new Error('useScan must be used within ScanProvider')
  return ctx
}
