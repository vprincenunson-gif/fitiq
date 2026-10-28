import { Spinner } from '../ui/Spinner'

/** Pending mock-detection indicator over the frozen frame. */
export function DetectionHUD() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-ink/55 backdrop-blur-[2px]">
      <div className="relative h-40 w-40">
        <div className="absolute inset-0 animate-pulse rounded-2xl border-2 border-beige/70" />
        <div className="absolute inset-x-4 top-1/2 h-px -translate-y-1/2 bg-beige/80" />
        <Spinner size={28} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-paper" />
      </div>
      <p className="text-sm font-medium tracking-wide text-paper">Identifying your item…</p>
    </div>
  )
}
