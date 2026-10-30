import type { SVGProps } from 'react'

export type IconName =
  | 'camera'
  | 'hanger'
  | 'model'
  | 'plus'
  | 'check'
  | 'x'
  | 'chevron-right'
  | 'chevron-left'
  | 'zoom-in'
  | 'zoom-out'
  | 'calendar'
  | 'arrow-right'
  | 'heart'
  | 'scan'
  | 'trash'
  | 'sparkle'
  | 'insights'

const PATHS: Record<IconName, React.ReactNode> = {
  camera: (
    <path d="M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z M12 17.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
  ),
  hanger: (
    <path d="M12 5.5a2.25 2.25 0 0 1 4.2 1.14c0 1.4-1.6 2.05-2.7 2.86H5.6a1.2 1.2 0 0 0-.73 2.14l10.9 8.36h-8.6M17.8 11.2h1a3.4 3.4 0 0 1 2.1 6.05" />
  ),
  model: (
    <path d="M12 3.5a2.6 2.6 0 1 1 0 5.2 2.6 2.6 0 0 1 0-5.2ZM4.5 21c.8-4.6 3.7-7 7.5-7s6.7 2.4 7.5 7" />
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="M5 12.5 10 17.5 19 7" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  'chevron-right': <path d="M9 5l7 7-7 7" />,
  'chevron-left': <path d="M15 5l-7 7 7 7" />,
  'zoom-in': (
    <path d="M11 18.5a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15ZM20.5 20.5 16 16M8.5 11h5M11 8.5v5" />
  ),
  'zoom-out': (
    <path d="M11 18.5a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15ZM20.5 20.5 16 16M8.5 11h5" />
  ),
  calendar: (
    <path d="M5 7h14a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1ZM8 4v4M16 4v4M4 11h16" />
  ),
  'arrow-right': <path d="M4 12h15M13 6l6 6-6 6" />,
  heart: <path d="M12 20s-7.5-4.6-9.3-9.1C1.4 7.6 3.5 4.5 6.8 4.5c2 0 3.8 1.2 4.7 3 .9-1.8 2.7-3 4.7-3 3.3 0 5.4 3.1 4.1 6.4C19.5 15.4 12 20 12 20Z" />,
  scan: (
    <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M8 12h8" />
  ),
  trash: (
    <path d="M5 7h14M10 7V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2M7 7l1 12a1 1 0 0 0 1 .9h6a1 1 0 0 0 1-.9l1-12M10 11v5M14 11v5" />
  ),
  sparkle: (
    <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z" />
  ),
  insights: (
    <path d="M4 20v-7M10 20V5M16 20v-9M2 20h20" />
  ),
}

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName
  size?: number
}

export function Icon({ name, size = 20, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  )
}
