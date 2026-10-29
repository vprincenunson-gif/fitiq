import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useScan } from '../stores/ScanContext'
import { useWardrobe } from '../stores/WardrobeContext'
import { CameraCapture, type CameraCaptureHandle } from '../components/scan/CameraCapture'
import { CaptureConsent } from '../components/scan/CaptureConsent'
import { ScanOverlay } from '../components/scan/ScanOverlay'
import { DetectionHUD } from '../components/scan/DetectionHUD'
import { ResultConfirm } from '../components/scan/ResultConfirm'
import { CameraErrorState } from '../components/scan/CameraErrorState'
import { Button } from '../components/ui/Button'
import { Icon } from '../components/ui/Icon'
import { Overline } from '../components/ui/Overline'
import { Spinner } from '../components/ui/Spinner'
import type { Garment } from '../lib/types'

export function ScanPage() {
  const scan = useScan()
  const { addGarment } = useWardrobe()
  const navigate = useNavigate()
  const cameraRef = useRef<CameraCaptureHandle>(null)

  // After the capture flash, pause for explicit consent before any analysis.
  useEffect(() => {
    if (scan.phase !== 'capturing') return
    const timer = setTimeout(() => scan.requestConsent(), 450)
    return () => clearTimeout(timer)
  }, [scan.phase, scan.requestConsent])

  const handleAdd = (name: string, category: Garment['category'], colorLabel: string) => {
    if (!scan.detected) return
    const garment: Garment = {
      id: `gar_${crypto.randomUUID()}`,
      name,
      category,
      color: scan.detected.color,
      colorLabel,
      styleTags: scan.detected.styleTags,
      fit: scan.detected.fit,
      // Use the actual captured camera photo; fall back to the detected
      // sample art only when nothing was captured (sample-item path).
      image: scan.capturedDataUrl ?? scan.detected.image,
      source: 'scanned',
      scannedAt: new Date().toISOString(),
      favorite: false,
    }
    addGarment(garment)
    scan.reset()
    navigate('/wardrobe')
  }

  const cameraStage = (children: ReactNode, overlay?: ReactNode) => (
    <div className="relative mx-auto aspect-[4/5] max-h-[76vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-ink">
      {children}
      {overlay}
    </div>
  )

  if (scan.phase === 'idle') {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center py-16 text-center md:py-24">
        <Overline>Scan</Overline>
        <h1 className="mt-4 font-display text-3xl md:text-4xl">Bring an item into your wardrobe.</h1>
        <p className="mt-4 max-w-md text-ink-soft">
          Hold the garment flat in good light, fill the frame, and let FITIQ identify it for you.
        </p>
        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
          <Button size="lg" onClick={scan.begin}>
            <Icon name="camera" size={18} />
            Start camera
          </Button>
        </div>
      </div>
    )
  }

  if (scan.phase === 'requesting' || scan.phase === 'live') {
    // Render one <CameraCapture> element for both phases. Keeping the same
    // element (rather than swapping branches) guarantees the mounted <video>
    // and its MediaStream survive the requesting → live transition.
    const requesting = scan.phase === 'requesting'
    return cameraStage(
      <CameraCapture
        ref={cameraRef}
        phase={scan.phase}
        onLive={scan.setLive}
        onError={scan.fail}
        onCaptured={scan.captured}
      />,
      requesting ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-ink/40">
          <Spinner size={28} />
          <p className="text-sm text-paper">Starting camera…</p>
        </div>
      ) : (
        <>
          <ScanOverlay captured={false} />
          <div className="absolute inset-x-0 bottom-6 flex justify-center">
            <button
              type="button"
              onClick={() => cameraRef.current?.capture()}
              aria-label="Capture photo"
              className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-paper bg-paper/15 backdrop-blur-sm transition-transform active:scale-95"
            >
              <span className="h-12 w-12 rounded-full bg-paper" />
            </button>
          </div>
        </>
      ),
    )
  }

  if (scan.phase === 'consent') {
    return (
      <CaptureConsent
        image={scan.capturedDataUrl}
        onAnalyze={() => scan.analyze('vision')}
        onLocal={() => scan.analyze('local')}
        onRescan={scan.rescan}
      />
    )
  }

  if (scan.phase === 'capturing' || scan.phase === 'detecting') {
    return cameraStage(
      <>
        {scan.capturedDataUrl && (
          <img src={scan.capturedDataUrl} alt="Captured frame" className="h-full w-full object-cover" />
        )}
        {scan.phase === 'detecting' && <DetectionHUD />}
      </>,
      <ScanOverlay captured={scan.phase === 'capturing'} />,
    )
  }

  if (scan.phase === 'confirming' && scan.detected) {
    return (
      <ResultConfirm
        detected={scan.detected}
        capturedImage={scan.capturedDataUrl}
        onAdd={handleAdd}
        onRescan={scan.rescan}
      />
    )
  }

  if (scan.phase === 'error') {
    return (
      <CameraErrorState
        message={scan.error ?? 'Something went wrong with the camera.'}
        onRetry={scan.begin}
      />
    )
  }

  return null
}
