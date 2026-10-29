import { useEffect, useMemo, useRef, useState } from 'react'
import type { Garment, OutfitComposition } from '../../lib/types'
import { Icon } from '../ui/Icon'

interface OutfitShowcaseProps {
  outfit: OutfitComposition
  composing?: boolean
}

const SLOTS = [
  { key: 'top', number: '01', category: 'Shirt', label: 'Top' },
  { key: 'bottom', number: '02', category: 'Pants', label: 'Bottom' },
  { key: 'shoes', number: '03', category: 'Shoes', label: 'Shoes' },
] as const

type SlotKey = (typeof SLOTS)[number]['key']

const SLOT_GARMENT: Record<SlotKey, keyof OutfitComposition> = {
  top: 'top',
  bottom: 'bottom',
  shoes: 'shoes',
}

const FIT_LABELS: Record<Garment['fit'], string> = {
  slim: 'Slim fit',
  regular: 'Regular fit',
  relaxed: 'Relaxed fit',
}

/** Detail-view magnification over the fitted size. */
const ZOOM_SCALE = 2.4

/* ────────────────────────────────────────────────────────────────────────
   Detail view — a full-bleed lightbox for one piece, shown at its stored
   original image. "Fit view" frames the whole photo; "detail view" magnifies
   it for zoom-inspection with drag-to-pan. No rendering, no try-on claims —
   the user's own capture, presented.
   ──────────────────────────────────────────────────────────────────────── */

interface PieceDetailOverlayProps {
  slot: (typeof SLOTS)[number]
  garment: Garment
  position: number
  count: number
  onClose: () => void
  onPrev: () => void
  onNext: () => void
}

function PieceDetailOverlay({
  slot,
  garment,
  position,
  count,
  onClose,
  onPrev,
  onNext,
}: PieceDetailOverlayProps) {
  const [zoomed, setZoomed] = useState(false)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  // Fitted (scale 1) geometry, measured the moment zoom is engaged.
  const baseRef = useRef<{ w: number; h: number; cw: number; ch: number } | null>(null)
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; panX: number; panY: number } | null>(null)

  // Scroll lock + focus handoff while the lightbox is open.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
      opener?.focus()
    }
  }, [])

  // Keyboard: Escape closes, arrow keys move between the stored pieces.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight' && position < count - 1) onNext()
      else if (e.key === 'ArrowLeft' && position > 0) onPrev()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, onNext, onPrev, position, count])

  // NOTE: the view resets between pieces via remount — the overlay is keyed
  // by slot garment id in OutfitShowcase below.

  const engageZoom = () => {
    const img = imageRef.current
    const container = containerRef.current
    if (img && container) {
      baseRef.current = {
        w: img.getBoundingClientRect().width,
        h: img.getBoundingClientRect().height,
        cw: container.getBoundingClientRect().width,
        ch: container.getBoundingClientRect().height,
      }
    }
    setZoomed(true)
  }

  const toggleZoom = () => {
    if (zoomed) {
      setZoomed(false)
      setPan({ x: 0, y: 0 })
    } else {
      engageZoom()
    }
  }

  const clampPan = (x: number, y: number) => {
    const base = baseRef.current
    if (!base) return { x: 0, y: 0 }
    const maxX = Math.max(0, (base.w * ZOOM_SCALE - base.cw) / 2)
    const maxY = Math.max(0, (base.h * ZOOM_SCALE - base.ch) / 2)
    return {
      x: Math.min(maxX, Math.max(-maxX, x)),
      y: Math.min(maxY, Math.max(-maxY, y)),
    }
  }

  const onPointerDown = (e: React.PointerEvent<HTMLImageElement>) => {
    if (!zoomed) return
    e.preventDefault()
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      panX: pan.x,
      panY: pan.y,
    }
    setDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent<HTMLImageElement>) => {
    const drag = dragRef.current
    if (!drag || e.pointerId !== drag.pointerId) return
    setPan(clampPan(drag.panX + (e.clientX - drag.startX), drag.panY + (e.clientY - drag.startY)))
  }

  const endPointerDrag = (e: React.PointerEvent<HTMLImageElement>) => {
    if (dragRef.current?.pointerId !== e.pointerId) return
    dragRef.current = null
    setDragging(false)
  }

  const detailContent = (
    <div className="surface relative flex h-full w-full flex-col overflow-hidden rounded-none bg-ink md:rounded-2xl">
      {/* Top bar — eyebrow, name, close */}
      <div className="flex items-start justify-between gap-4 px-6 pt-6 md:px-8">
        <div className="min-w-0">
          <p className="overline !text-paper/50">
            Piece {slot.number} · {slot.category}
          </p>
          <p className="mt-1 truncate font-display text-xl text-paper md:text-2xl">{garment.name}</p>
        </div>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close detail view"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-paper/25 text-paper/80 transition-colors hover:border-paper/60 hover:text-paper"
        >
          <Icon name="x" size={16} />
        </button>
      </div>

      {/* Image stage */}
      <div
        ref={containerRef}
        className="relative mt-5 flex min-h-0 flex-1 items-center justify-center overflow-hidden px-6 md:px-8"
      >
        <img
          ref={imageRef}
          key={garment.id}
          src={garment.image}
          alt={`${garment.name} — ${slot.category.toLowerCase()}, viewed at ${zoomed ? 'detail zoom' : 'full view'}`}
          draggable={false}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPointerDrag}
          onPointerCancel={endPointerDrag}
          onDoubleClick={() => {
            if (zoomed) {
              setZoomed(false)
              setPan({ x: 0, y: 0 })
            } else {
              engageZoom()
            }
          }}
          onClick={() => {
            if (!zoomed) engageZoom()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              toggleZoom()
            }
          }}
          tabIndex={0}
          role="button"
          aria-label={zoomed ? 'Return to fit view' : 'Magnify for detail view'}
          className={[
            'max-h-full max-w-full select-none object-contain outline-none',
            zoomed ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in',
          ].join(' ')}
          style={{
            transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoomed ? ZOOM_SCALE : 1})`,
            transition: dragging ? 'none' : 'transform 350ms var(--ease-editorial)',
            filter: 'drop-shadow(0 24px 48px rgb(0 0 0 / 0.35))',
          }}
        />
        <span className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-ink/60 px-3 py-1 text-[0.6875rem] font-medium uppercase tracking-wider text-paper/70 backdrop-blur-sm">
          {zoomed ? 'Drag to explore · double-click to fit' : 'Click to inspect detail'}
        </span>
      </div>

      {/* Bottom bar — metadata and controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-6 pb-6 pt-5 md:px-8">
        <div className="min-w-0 text-xs text-paper/60">
          <p className="truncate">
            {garment.colorLabel} · {FIT_LABELS[garment.fit]}
          </p>
          {garment.styleTags.length > 0 && (
            <p className="mt-1 truncate">{garment.styleTags.join(' · ')}</p>
          )}
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onPrev}
            disabled={position === 0}
            aria-label="Previous piece"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-paper/25 text-paper/80 transition-colors hover:border-paper/60 hover:text-paper disabled:opacity-30 disabled:hover:border-paper/25 disabled:hover:text-paper/80"
          >
            <Icon name="chevron-left" size={15} />
          </button>
          <span className="min-w-[3.5rem] text-center text-xs font-medium tracking-wider text-paper/50">
            {position + 1} / {count}
          </span>
          <button
            type="button"
            onClick={onNext}
            disabled={position === count - 1}
            aria-label="Next piece"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-paper/25 text-paper/80 transition-colors hover:border-paper/60 hover:text-paper disabled:opacity-30 disabled:hover:border-paper/25 disabled:hover:text-paper/80"
          >
            <Icon name="chevron-right" size={15} />
          </button>
          <button
            type="button"
            onClick={toggleZoom}
            aria-label={zoomed ? 'Switch to fit view' : 'Switch to detail view'}
            className="ml-2 flex items-center gap-2 rounded-full border border-paper/25 px-4 py-2 text-xs font-medium uppercase tracking-wider text-paper/80 transition-colors hover:border-paper/60 hover:text-paper"
          >
            <Icon name={zoomed ? 'zoom-out' : 'zoom-in'} size={14} />
            {zoomed ? 'Fit view' : 'Detail view'}
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${garment.name} — piece ${slot.number}`}
      className="fixed inset-0 z-50 flex items-stretch justify-center p-0 md:inset-6 md:items-center md:p-6"
      style={{ animation: 'fade-in var(--duration-med) var(--ease-editorial) both' }}
    >
      <button
        type="button"
        aria-label="Close detail view"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-ink/90 backdrop-blur-sm"
      />
      <div className="relative h-full w-full md:h-auto md:w-auto md:max-w-3xl md:flex-1">{detailContent}</div>
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────────── */

interface PiecePanelProps {
  garment: Garment | null
  slot: (typeof SLOTS)[number]
  entranceDelayMs: number
  onInspect: () => void
}

function PiecePanel({ garment, slot, entranceDelayMs, onInspect }: PiecePanelProps) {
  return (
    <div
      className="flex h-full min-h-0 flex-col"
      style={{ animation: 'rise-in 600ms var(--ease-editorial) both', animationDelay: `${entranceDelayMs}ms` }}
    >
      {garment ? (
        <button
          type="button"
          onClick={onInspect}
          aria-label={`Inspect ${garment.name} in detail view`}
          className="group block w-full cursor-zoom-in text-left outline-none"
        >
          <div
            className="img-shell relative flex aspect-[4/5] items-center justify-center overflow-hidden rounded-2xl bg-cream/40 transition-shadow duration-[250ms] group-hover:shadow-[var(--shadow-hover)]"
            style={{ transitionTimingFunction: 'var(--ease-editorial)' }}
          >
            <img
              key={garment.id}
              src={garment.image}
              alt={`${garment.name} — ${slot.category.toLowerCase()}`}
              className="max-h-full max-w-full object-contain transition-transform duration-500 group-hover:scale-[1.03]"
              style={{
                transitionTimingFunction: 'var(--ease-editorial)',
                filter: 'drop-shadow(0 12px 24px rgb(22 19 16 / 0.14))',
              }}
            />
            <span className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-paper-raised/90 px-2.5 py-1 text-[0.6875rem] font-medium uppercase tracking-wider text-ink-soft opacity-0 shadow-sm backdrop-blur-sm transition-opacity duration-300 group-hover:opacity-100">
              <Icon name="zoom-in" size={12} />
              Inspect
            </span>
          </div>

          <div className="mt-4">
            <p className="overline">
              <span className="font-display text-sm normal-case tracking-normal text-beige-deep">{slot.number}</span>
              <span className="ml-2">{slot.category}</span>
            </p>
            <p className="mt-1 truncate font-display text-[1.0625rem] leading-snug text-ink transition-colors group-hover:text-beige-deep">
              {garment.name}
            </p>
            <p className="mt-1 text-xs text-ink-faint">
              {garment.colorLabel} · {FIT_LABELS[garment.fit]}
            </p>
            {garment.styleTags.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {garment.styleTags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-line bg-cream/50 px-2.5 py-0.5 text-[0.6875rem] font-medium text-ink-soft"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </button>
      ) : (
        <div className="flex flex-col">
          <div className="img-shell relative flex aspect-[4/5] items-center justify-center overflow-hidden rounded-2xl bg-cream/40">
            <div className="flex flex-col items-center gap-3 text-ink-faint">
              <span className="flex h-14 w-14 items-center justify-center rounded-full border border-line bg-paper-raised">
                <Icon name="plus" size={20} />
              </span>
              <p className="text-xs font-medium uppercase tracking-wider">Not selected</p>
              <p className="text-[0.6875rem] text-ink-faint">pick from the tray below</p>
            </div>
          </div>
          <div className="mt-4">
            <p className="overline">
              <span className="font-display text-sm normal-case tracking-normal text-ink-faint/70">{slot.number}</span>
              <span className="ml-2">{slot.category}</span>
            </p>
            <p className="mt-1 font-display text-[1.0625rem] leading-snug text-ink-faint">
              No {slot.label.toLowerCase()} yet
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * "Your Fit" — the outfit showcase. The selected shirt, pants and shoes are
 * presented as three large, individual pieces — their real wardrobe images —
 * arranged as one cohesive editorial triptych. Clicking any piece opens a
 * full-bleed detail view with magnification and drag-to-pan. The clothing is
 * the hero; the presentation never claims fit or try-on.
 */
export function OutfitShowcase({ outfit, composing = false }: OutfitShowcaseProps) {
  const [inspectSlot, setInspectSlot] = useState<SlotKey | null>(null)

  const selected = SLOTS.filter((slot) => outfit[SLOT_GARMENT[slot.key]]).length
  const complete = selected === 3

  const inspectable = useMemo(
    () => SLOTS.filter((slot) => outfit[SLOT_GARMENT[slot.key]] !== null),
    [outfit],
  )

  const inspecting = inspectSlot ? inspectable.find((slot) => slot.key === inspectSlot) : undefined
  const inspectGarment = inspectSlot ? outfit[SLOT_GARMENT[inspectSlot]] : null
  // If the inspected slot is emptied from the composer mid-view, the guard
  // below simply stops rendering the overlay — no effect needed.

  const inspectIndex = inspectSlot ? inspectable.findIndex((s) => s.key === inspectSlot) : -1
  const position = inspectIndex >= 0 ? inspectIndex : 0
  const stepBy = (delta: number) => {
    const next = (position + delta + inspectable.length) % inspectable.length
    setInspectSlot(inspectable[next].key)
  }

  return (
    <section className="surface overflow-hidden rounded-3xl" aria-label="Your outfit showcase">
      <div className="flex items-baseline justify-between border-b border-line px-6 py-5 md:px-8">
        <div>
          <p className="overline">Your Fit</p>
          <h2 className="mt-1 font-display text-2xl">Your selected look.</h2>
        </div>
        <p
          className={[
            'inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider',
            complete ? 'text-forest' : 'text-ink-faint',
          ].join(' ')}
        >
          {complete && <Icon name="check" size={13} />}
          {complete ? 'Complete look' : `${selected} of 3 pieces`}
        </p>
      </div>

      <div
        className="grid grid-cols-1 divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0"
        style={{
          opacity: composing ? 0.5 : 1,
          transition: 'opacity 500ms var(--ease-editorial)',
        }}
      >
        {SLOTS.map((slot, index) => (
          <div key={slot.key} className="p-6 md:p-7">
            <PiecePanel
              garment={outfit[SLOT_GARMENT[slot.key]]}
              slot={slot}
              entranceDelayMs={90 * index}
              onInspect={() => setInspectSlot(slot.key)}
            />
          </div>
        ))}
      </div>

      <p className="border-t border-line px-6 py-3.5 text-[0.6875rem] uppercase tracking-[0.18em] text-ink-faint md:px-8">
        Pieces shown as stored — your original photos, not simulations. Click a piece to inspect it in detail.
      </p>

      {inspecting && inspectGarment && (
        <PieceDetailOverlay
          key={`${inspecting.key}:${inspectGarment.id}`}
          slot={inspecting}
          garment={inspectGarment}
          position={position}
          count={inspectable.length}
          onClose={() => setInspectSlot(null)}
          onPrev={() => stepBy(-1)}
          onNext={() => stepBy(1)}
        />
      )}
    </section>
  )
}
