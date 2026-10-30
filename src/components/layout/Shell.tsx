import type { ReactNode } from 'react'
import { Header } from './Header'
import { Footer } from './Footer'
import { MobileTabs } from './MobileTabs'
import { CloudStatusBanner } from '../sync/CloudStatusBanner'

interface ShellProps {
  children: ReactNode
  /** Hide page-wide padding (used by Scan's full-bleed camera). */
  bleed?: boolean
}

export function Shell({ children, bleed = false }: ShellProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <CloudStatusBanner />
      <main className={`flex-1 ${bleed ? '' : 'container-editorial py-12 md:py-16'}`}>
        {children}
      </main>
      <Footer />
      <MobileTabs />
    </div>
  )
}
