import type { HTMLAttributes } from 'react'

export function Overline({ className = '', ...rest }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={`overline ${className}`} {...rest} />
}
