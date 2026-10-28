import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { ScanPhase } from '../../stores/ScanContext'

interface CameraCaptureProps {
  phase: ScanPhase
  onLive: () => void
  onError: (message: string) => void
  onCaptured: (dataUrl: string) => void
}

export interface CameraCaptureHandle {
  capture: () => void
}

const CAPTURE_WIDTH = 640
const CAPTURE_HEIGHT = 480

/** Give getUserMedia a hard deadline so "Starting camera…" can't hang. */
const STARTUP_TIMEOUT_MS = 7000

export const CameraCapture = forwardRef<CameraCaptureHandle, CameraCaptureProps>(
  function CameraCapture({ phase, onLive, onError, onCaptured }, ref) {
    const videoRef = useRef<HTMLVideoElement>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const [busy, setBusy] = useState(false)
    // Guards against duplicate getUserMedia calls (StrictMode remounts,
    // effect re-runs), one pending startup at a time.
    const startingRef = useRef(false)

    const stopStream = useCallback(() => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }
    }, [])

    useEffect(() => {
      if (phase !== 'requesting') return

      let cancelled = false
      let settled = false
      let stream: MediaStream | null = null

      const stopPartialStream = () => {
        if (stream) {
          stream.getTracks().forEach((t) => t.stop())
          stream = null
        }
      }

      // Hard deadline: if getUserMedia hasn't settled in time, tear down
      // anything partially created and hand off to the error state.
      const timeout = setTimeout(() => {
        if (cancelled || settled) return
        settled = true
        stopPartialStream()
        onError('Camera is taking too long to start. Please try again.')
      }, STARTUP_TIMEOUT_MS)

      const start = async () => {
        if (startingRef.current) return // avoid duplicate camera requests
        startingRef.current = true
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          })
          if (cancelled || settled) {
            stopPartialStream()
            return
          }
          clearTimeout(timeout)
          settled = true
          streamRef.current = stream
          const video = videoRef.current
          if (video) {
            video.srcObject = stream
            await video.play().catch(() => undefined)
          }
          onLive()
        } catch (err) {
          if (cancelled || settled) return
          clearTimeout(timeout)
          settled = true
          stopPartialStream()
          const isPermission =
            (err as DOMException)?.name === 'NotAllowedError' ||
            (err as DOMException)?.name === 'SecurityError'
          onError(
            isPermission
              ? 'Camera permission was denied. Allow camera access in your browser to scan.'
              : 'No camera found on this device.',
          )
        }
      }

      void start()
      return () => {
        cancelled = true
        clearTimeout(timeout)
        stopPartialStream()
        startingRef.current = false
        stopStream()
      }
    }, [phase, onLive, onError, stopStream])

    useEffect(() => {
      if (phase !== 'live' && phase !== 'capturing') {
        stopStream()
      }
    }, [phase, stopStream])

    useEffect(() => stopStream, [stopStream])

    useImperativeHandle(
      ref,
      () => ({
        capture() {
          const video = videoRef.current
          if (!video || video.readyState < 2 || busy) return
          setBusy(true)
          const canvas = document.createElement('canvas')
          canvas.width = CAPTURE_WIDTH
          canvas.height = CAPTURE_HEIGHT
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            setBusy(false)
            return
          }
          const scale = Math.min(
            CAPTURE_WIDTH / video.videoWidth,
            CAPTURE_HEIGHT / video.videoHeight,
            (video.videoWidth || 1) / (video.videoWidth || 1),
          )
          const w = video.videoWidth * scale
          const h = video.videoHeight * scale
          ctx.drawImage(video, (CAPTURE_WIDTH - w) / 2, (CAPTURE_HEIGHT - h) / 2, w, h)
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
          setBusy(false)
          onCaptured(dataUrl)
        },
      }),
      [busy, onCaptured],
    )

    return (
      <video
        ref={videoRef}
        muted
        autoPlay
        playsInline
        className="h-full w-full object-cover"
        aria-label="Live camera preview"
      />
    )
  },
)
