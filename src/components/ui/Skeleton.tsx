interface SkeletonProps {
  className?: string
}

/** Subtle shimmer placeholder. */
export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-md bg-cream ${className}`}
    />
  )
}
