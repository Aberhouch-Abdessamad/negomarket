import { Handshake, KeyRound, MapPin, Package, ShieldAlert, UserRound } from 'lucide-react'
import { NavLink, Outlet } from 'react-router'
import { cn } from '@/utils/cn'

const items = [
  { to: '/account/profile', label: 'Profile', icon: UserRound },
  { to: '/orders', label: 'My orders', icon: Package },
  { to: '/account/disputes', label: 'Disputes', icon: ShieldAlert },
  { to: '/account/security', label: 'Password & security', icon: KeyRound },
  { to: '/account/addresses', label: 'Addresses', icon: MapPin },
  { to: '/negotiations', label: 'My negotiations', icon: Handshake },
]

export default function AccountLayout() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 lg:px-8 lg:py-10">
      <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">My account</h1>
      <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:gap-10">
        <nav aria-label="Account" className="-mx-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:w-60 lg:shrink-0 lg:flex-col lg:px-0">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'inline-flex shrink-0 items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors',
                  isActive ? 'bg-surface text-brand-700 shadow-sm ring-1 ring-line' : 'text-ink-muted hover:bg-surface hover:text-ink',
                )
              }
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="min-w-0 flex-1">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
