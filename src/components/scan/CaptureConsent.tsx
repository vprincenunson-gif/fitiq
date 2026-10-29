import { useState } from 'react'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'

interface CaptureConsentProps {
  image: string | null
  onAnalyze: () => void
  onLocal: () => void
  onRescan: () => void
}

/**
 * Explicit consent gate between capture and analysis. The photo is not sent
 * anywhere until the user ticks the box and chooses the AI action; the local
 * option never uploads it.
 */
export function CaptureConsent({ image, onAnalyze, onLocal, onRescan }: CaptureConsentProps) {
  const [consented, setConsented] = useState(false)

  return (
    <div className="mx-auto w-full max-w-lg">
      <div className="surface overflow-hidden rounded-2xl">
        <div className="flex items-center justify-center bg-cream/60 py-10">
          {image ? (
            <img
              src={image}
              alt="Newly captured garment"
              className="h-56 w-56 object-contain"
            />
          ) : (
            <span className="flex h-56 w-56 items-center justify-center rounded-xl border border-line text-ink-faint">
              <Icon name="camera" size={28} />
            </span>
          )}
        </div>

        <div className="space-y-5 p-7">
          <div>
            <p className="overline mb-2">Review capture</p>
            <h2 className="font-display text-xl text-ink">Identify this item with AI?</h2>
          </div>

          <p className="text-sm leading-relaxed text-ink-soft">
            This photo will be sent to <strong className="font-medium text-ink">Groq</strong>,
            a third-party AI provider, and processed by the{' '}
            <code className="rounded bg-cream/70 px-1 py-0.5 text-[0.8em] text-ink">
              qwen/qwen3.8-27b
            </code>{' '}
            vision model to identify the garment. FITIQ does not store or log the
            photo, and your Groq API key is never exposed to the browser.
          </p>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-cream/30 p-4 text-sm text-ink">
            <input
              type="checkbox"
              checked={consented}
              onChange={(e) => setConsented(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-ink"
            />
            <span>I agree to send this photo to Groq for AI analysis.</span>
          </label>

          <div className="flex flex-col gap-3 pt-1">
            <Button onClick={onAnalyze} disabled={!consented} fullWidth>
              <Icon name="sparkle" size={16} />
              Send photo &amp; analyze
            </Button>
            <Button variant="ghost" onClick={onLocal} fullWidth>
              Use on-device detection instead
            </Button>
            <Button variant="text" onClick={onRescan}>
              Rescan
            </Button>
          </div>

          <p className="text-center text-xs text-ink-faint">
            On-device detection never uploads the image. If AI analysis fails,
            FITIQ automatically falls back to it.
          </p>
        </div>
      </div>
    </div>
  )
}
