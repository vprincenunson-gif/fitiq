import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { DetectedGarment } from '../lib/types'
import { detectionService } from '../services'

export type ScanPhase =
  | 'idle'
  | 'requesting'
  | 'live'
  | 'capturing'
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
  confirmCapture: () => void
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

  const begin = useCallback(() => setPhase('requesting'), [])
  const setLive = useCallback(() => setPhase('live'), [])

  const captured = useCallback((dataUrl: string) => {
    setCapturedDataUrl(dataUrl)
    setPhase('capturing')
  }, [])

  /** Called after ‘capturing’ — runs the (mock) AI detection. */
  const confirmCapture = useCallback(() => {
    setPhase('detecting')
    const run = ++detectRun.current
    detectionService.detect(capturedDataUrl ?? '').then((result) => {
      if (run !== detectRun.current) return // stale
      setDetected(result)
      setPhase('confirming')
    })
  }, [capturedDataUrl])

  const rescan = useCallback(() => {
    setDetected(null)
    setCapturedDataUrl(null)
    setPhase('live')
  }, [])

  const fail = useCallback((message: string) => {
    setError(message)
    setPhase('error')
  }, [])

  const reset = useCallback(() => {
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
      confirmCapture,
      rescan,
      fail,
      reset,
    }),
    [phase, error, capturedDataUrl, detected, begin, setLive, captured, confirmCapture, rescan, fail, reset],
  )

  return <ScanContext.Provider value={value}>{children}</ScanContext.Provider>
}

export function useScan(): ScanContextValue {
  const ctx = useContext(ScanContext)
  if (!ctx) throw new Error('useScan must be used within ScanProvider')
  return ctx
}
