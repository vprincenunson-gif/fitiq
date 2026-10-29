import { NavLink } from 'react-router-dom'
import { Icon } from '../ui/Icon'
import type { IconName } from '../ui/Icon'

const TABS: { to: string; label: string; icon: IconName }[] = [
  { to: '/wardrobe', label: 'Wardrobe', icon: 'hanger' },
  { to: '/try-on', label: 'Your Fit', icon: 'hanger' },
  { to: '/planner', label: 'Planner', icon: 'calendar' },
  { to: '/scan', label: 'Scan', icon: 'camera' },
]

/** Bottom tab bar for small screens. */
export function MobileTabs() {
  return (
    <nav
      aria-label="Primary mobile"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper-raised/95 backdrop-blur-sm md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="grid grid-cols-4">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              [
                'flex flex-col items-center gap-1 py-3 text-[0.6875rem] font-medium tracking-wide',
                'transition-colors',
                isActive ? 'text-ink' : 'text-ink-faint',
              ].join(' ')
            }
          >
            <Icon name={tab.icon} size={20} />
            {tab.label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
