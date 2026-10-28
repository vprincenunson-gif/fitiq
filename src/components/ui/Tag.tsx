import type { ButtonHTMLAttributes } from 'react'

interface TagProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
}

/** Pill label / filter chip. */
export function Tag({ active = false, className = '', children, ...rest }: TagProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={[
        'inline-flex items-center gap-1.5 rounded-full border px-4 h-9 text-[0.8125rem] font-medium whitespace-nowrap',
        'transition-[background-color,border-color,color,box-shadow] duration-200 ease-editorial',
        active
          ? 'border-ink bg-ink text-paper shadow-sm'
          : 'border-line bg-transparent text-ink-soft hover:border-ink/30 hover:text-ink',
        className,
      ].join(' ')}
      {...rest}
    >
      {children}
    </button>
  )
}
