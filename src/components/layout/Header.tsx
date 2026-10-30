import { Link, NavLink, useLocation } from 'react-router-dom'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'
import { AccountMenu } from '../auth/AccountMenu'

const NAV = [
  { to: '/wardrobe', label: 'Wardrobe' },
  { to: '/try-on', label: 'Your Fit' },
  { to: '/planner', label: 'Planner' },
  { to: '/insights', label: 'Insights' },
]

export function Header() {
  const { pathname } = useLocation()
  const onHome = pathname === '/'

  return (
    <header
      className={[
        'sticky top-0 z-40 border-b border-line/70 bg-paper/90 backdrop-blur-sm',
        'transition-colors duration-300',
        onHome ? 'border-transparent bg-transparent backdrop-blur-none' : '',
      ].join(' ')}
    >
      <div className="container-editorial flex h-16 items-center justify-between md:h-20">
        <Link to="/" className="group flex items-baseline gap-1" aria-label="FITIQ home">
          <span className="font-display text-xl font-medium tracking-tight text-ink">FITIQ</span>
          <span className="h-1 w-1 rounded-full bg-beige-deep transition-transform duration-300 ease-editorial group-hover:scale-150" />
        </Link>

        <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                [
                  'relative text-sm font-medium tracking-wide transition-colors duration-200',
                  isActive ? 'text-ink' : 'text-ink-soft hover:text-ink',
                  'after:absolute after:-bottom-1.5 after:left-0 after:h-px after:bg-ink after:transition-all after:duration-300 after:ease-editorial',
                  isActive ? 'after:w-full' : 'after:w-0 hover:after:w-full',
                ].join(' ')
              }
            >
              {item.label}
            </NavLink>
          ))}
          <Link to="/scan">
            <Button size="sm" variant="ghost">
              <Icon name="camera" size={16} />
              Scan
            </Button>
          </Link>
          <AccountMenu />
        </nav>

        <div className="flex items-center gap-3 md:hidden">
          <AccountMenu />
          <Link to="/scan" aria-label="Scan an item">
            <Button size="sm" variant="ghost">
              <Icon name="camera" size={16} />
            </Button>
          </Link>
        </div>
      </div>
    </header>
  )
}
