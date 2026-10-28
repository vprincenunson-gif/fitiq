interface ScanOverlayProps {
  captured: boolean
}

/** Editorial camera chrome: corner brackets + instruction. */
export function ScanOverlay({ captured }: ScanOverlayProps) {
  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute left-1/2 top-1/2 h-[62%] w-[78%] -translate-x-1/2 -translate-y-1/2">
        <span className="absolute left-0 top-0 h-8 w-8 border-l-2 border-t-2 border-clay" />
        <span className="absolute right-0 top-0 h-8 w-8 border-r-2 border-t-2 border-clay" />
        <span className="absolute bottom-0 left-0 h-8 w-8 border-b-2 border-l-2 border-clay" />
        <span className="absolute bottom-0 right-0 h-8 w-8 border-b-2 border-r-2 border-clay" />
      </div>

      <div className="absolute inset-x-0 bottom-10 flex flex-col items-center gap-2 px-8">
        <p className="text-sm font-medium tracking-wide text-paper drop-shadow-[0_1px_4px_rgba(25,23,19,0.6)]">
          Hold the garment flat, in good light
        </p>
        <p className="text-xs text-paper/70 drop-shadow-[0_1px_4px_rgba(25,23,19,0.6)]">
          Make sure the whole item fits inside the frame
        </p>
      </div>

      <div
        className={[
          'absolute inset-0 bg-paper transition-opacity duration-200',
          captured ? 'opacity-90' : 'pointer-events-none opacity-0',
        ].join(' ')}
      />
    </div>
  )
}
