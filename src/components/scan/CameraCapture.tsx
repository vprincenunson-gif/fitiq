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
/** How long to wait for the first playable frame after the stream attaches. */
const PLAYBACK_TIMEOUT_MS = 4000

/**
 * The camera runs while we are asking for it AND once it is live. Crucially,
 * `requesting → live` must not tear the stream down: the stream belongs to
 * the mounted <video>, not to a single phase.
 */
const CAMERA_PHASES: ReadonlySet<ScanPhase> = new Set<ScanPhase>(['requesting', 'live'])

const delay = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms))

function stopTracks(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => {
    track.onended = null
    track.stop()
  })
}

/** Turn a camera failure into a message the error screen can show. */
function describeCameraError(err: unknown): string {
  if (err instanceof DOMException) {
    switch (err.name) {
      case 'NotAllowedError':
      case 'SecurityError':
        return 'Camera permission was denied. Allow camera access in your browser to scan.'
      case 'NotFoundError':
      case 'DevicesNotFoundError':
        return 'No camera found on this device.'
      case 'NotReadableError':
      case 'TrackStartError':
        return 'Your camera is already in use by another app. Close it and try again.'
      case 'OverconstrainedError':
        return 'This device could not provide a compatible camera stream. Please try again.'
      case 'NotSupportedError':
        return 'This browser or device does not support camera capture.'
      default:
        break
    }
  }

  const message = err instanceof Error ? err.message : ''
  if (message === 'unsupported') {
    return 'Camera access needs a secure (HTTPS) connection and a browser with camera support.'
  }
  if (message === 'timeout') {
    return 'Camera is taking too long to start. Please try again.'
  }
  if (message === 'no-video-track') {
    return 'The camera did not provide a video track. Please try again.'
  }
  if (message === 'playback') {
    return 'The camera started, but the preview could not play. Please try again.'
  }
  return 'Something went wrong with the camera. Please try again.'
}

/**
 * Wait until the <video> is actually showing frames. Resolving only after
 * playback has begun prevents the UI from switching to "live" over a black
 * element (and makes capture reliable straight away).
 */
async function waitForPlayback(
  video: HTMLVideoElement,
  timeoutMs: number,
  isCurrent: () => boolean,
): Promise<boolean> {
  // Muted + playsInline + autoPlay makes this allowed without a gesture.
  void video.play().catch(() => undefined)

  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (!isCurrent()) return false
    if (!video.paused && video.readyState >= 2 && video.videoWidth > 0) return true
    await delay(50)
  }
  return isCurrent() && !video.paused && video.readyState >= 2 && video.videoWidth > 0
}

export const CameraCapture = forwardRef<CameraCaptureHandle, CameraCaptureProps>(
  function CameraCapture({ phase, onLive, onError, onCaptured }, ref) {
    const videoRef = useRef<HTMLVideoElement>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const [busy, setBusy] = useState(false)

    // Latest callbacks, so the start routine never closes over stale props.
    const callbacksRef = useRef({ onLive, onError, onCaptured })
    useEffect(() => {
      callbacksRef.current = { onLive, onError, onCaptured }
    })

    // One in-flight startup at a time (StrictMode remounts / effect re-runs),
    // and a token so late getUserMedia results can be discarded and stopped.
    const startPromiseRef = useRef<Promise<void> | null>(null)
    const attemptRef = useRef(0)
    const mountedRef = useRef(true)
    const activeRef = useRef(false)

    const stopStream = useCallback(() => {
      attemptRef.current += 1
      startPromiseRef.current = null
      const stream = streamRef.current
      streamRef.current = null
      stopTracks(stream)
      if (videoRef.current) videoRef.current.srcObject = null
    }, [])

    // Real unmount only: release the camera so the device indicator turns off.
    useEffect(() => {
      mountedRef.current = true
      return () => {
        mountedRef.current = false
        activeRef.current = false
        stopStream()
      }
    }, [stopStream])

    const startCamera = useCallback(async () => {
      if (!mountedRef.current || !activeRef.current) return
      if (startPromiseRef.current) return startPromiseRef.current

      const existing = streamRef.current
      if (existing && existing.getVideoTracks().some((t) => t.readyState === 'live')) return

      const attempt = ++attemptRef.current
      const isCurrent = () =>
        mountedRef.current && activeRef.current && attempt === attemptRef.current

      const promise = (async () => {
        try {
          const mediaDevices = navigator.mediaDevices
          if (!mediaDevices || typeof mediaDevices.getUserMedia !== 'function') {
            throw new Error('unsupported')
          }

          const request = mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          })

          let timer: number | undefined
          let stream: MediaStream
          try {
            stream = await Promise.race([
              request,
              new Promise<never>((_, reject) => {
                timer = window.setTimeout(() => reject(new Error('timeout')), STARTUP_TIMEOUT_MS)
              }),
            ])
          } catch (err) {
            // A stream that arrives after the deadline must not stay open.
            if (err instanceof Error && err.message === 'timeout') {
              void request.then(stopTracks).catch(() => undefined)
            }
            throw err
          } finally {
            if (timer !== undefined) window.clearTimeout(timer)
          }

          if (!isCurrent()) {
            stopTracks(stream)
            return
          }

          const track = stream.getVideoTracks()[0]
          if (!track) {
            stopTracks(stream)
            throw new Error('no-video-track')
          }

          streamRef.current = stream
          // Unexpected end (device unplugged, camera revoked) → recoverable error.
          track.onended = () => {
            if (!mountedRef.current || !activeRef.current) return
            if (streamRef.current !== stream) return
            callbacksRef.current.onError(
              'The camera stream stopped unexpectedly. Please try again.',
            )
          }

          const video = videoRef.current
          if (!video) {
            stopTracks(stream)
            streamRef.current = null
            return
          }

          video.srcObject = stream
          video.muted = true

          const playing = await waitForPlayback(video, PLAYBACK_TIMEOUT_MS, isCurrent)
          if (!isCurrent()) return
          if (!playing) throw new Error('playback')

          callbacksRef.current.onLive()
        } catch (err) {
          if (!isCurrent()) return
          stopStream()
          callbacksRef.current.onError(describeCameraError(err))
        } finally {
          if (attemptRef.current === attempt) startPromiseRef.current = null
        }
      })()

      startPromiseRef.current = promise
      await promise
    }, [stopStream])

    // Start once per camera session; `requesting → live` leaves `active` true
    // so this effect does NOT re-run and the stream keeps running. Leaving the
    // camera phases (capture/detect/confirm/error/idle) stops it.
    const active = CAMERA_PHASES.has(phase)
    useEffect(() => {
      activeRef.current = active
      if (!active) {
        stopStream()
        return
      }
      void startCamera()
    }, [active, startCamera, stopStream])

    useImperativeHandle(
      ref,
      () => ({
        capture() {
          const video = videoRef.current
          if (!video || busy) return
          if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) return
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
            1,
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
