import { ArrowLeft, ExternalLink, type LucideIcon, Menu, Search, X } from 'lucide-react'
import { type FormEvent, type ReactNode, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { AccountMenu } from '@/components/layout/AccountMenu'
import { Logo } from '@/components/layout/Logo'
import { cn } from '@/utils/cn'

export interface ShellNavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
  soon?: string
}

export interface ShellNavGroup {
  label?: string
  items: ShellNavItem[]
}

interface AppShellProps {
  area: string
  home: string
  groups: ShellNavGroup[]
  /** Optional block under the logo (e.g. the seller's store). */
  context?: ReactNode
  /** When set, the top bar shows a search box that navigates to `${searchPath}?q=`. */
  searchPath?: string
  searchPlaceholder?: string
}

/**
 * Dedicated application shell for the seller center and the admin panel:
 * dark sidebar, its own top bar, independent from the storefront header.
 */
export function AppShell({ area, home, groups, context, searchPath, searchPlaceholder }: AppShellProps) {
  const [open, setOpen] = useState(false)
  const location = useLocation()

  // Close the mobile drawer on navigation.
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    setOpen(false)
  }, [location.pathname])

  const sidebar = (
    <div className="flex h-full flex-col bg-brand-950 text-brand-100">
      <div className="flex h-16 items-center justify-between gap-2 px-5">
        <Logo inverted to={home} />
        <button type="button" onClick={() => setOpen(false)} aria-label="Close navigation" className="rounded-lg p-1.5 text-brand-200 hover:bg-white/10 lg:hidden"><X className="size-5" /></button>
      </div>
      <p className="px-5 text-[11px] font-bold uppercase tracking-[0.16em] text-accent-400">{area}</p>
      {context && <div className="px-3 pt-4">{context}</div>}
      <nav aria-label={area} className="mt-4 flex-1 space-y-5 overflow-y-auto px-3 pb-6">
        {groups.map((group, gi) => (
          <div key={group.label ?? gi}>
            {group.label && <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-brand-300/70">{group.label}</p>}
            <ul className="space-y-0.5">
              {group.items.map(({ to, label, icon: Icon, end, soon }) => (
                <li key={to}>
                  {soon ? (
                    <span title={`Available in ${soon}`} className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm text-brand-300/60">
                      <Icon className="size-[18px]" aria-hidden />
                      <span className="flex-1">{label}</span>
                      <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-brand-200">Soon</span>
                    </span>
                  ) : (
                    <NavLink
                      to={to}
                      end={end}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
                          isActive ? 'bg-brand-600 text-white shadow-sm' : 'text-brand-100 hover:bg-white/10 hover:text-white',
                        )
                      }
                    >
                      <Icon className="size-[18px]" aria-hidden />
                      {label}
                    </NavLink>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-white/10 p-3">
        <Link to="/" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-brand-200 hover:bg-white/10 hover:text-white">
          <ArrowLeft className="size-4" aria-hidden /> Back to marketplace
        </Link>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-canvas">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/50" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute inset-y-0 left-0 w-72 shadow-2xl">{sidebar}</div>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur sm:px-6">
          <button type="button" onClick={() => setOpen(true)} aria-label="Open navigation" className="-ml-1 rounded-lg p-2 hover:bg-canvas lg:hidden"><Menu className="size-5" /></button>
          {searchPath ? <ShellSearch path={searchPath} placeholder={searchPlaceholder} /> : <div className="flex-1" />}
          <Link to="/" className="ml-auto hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-ink-muted hover:bg-canvas hover:text-ink sm:inline-flex">
            Storefront <ExternalLink className="size-3.5" aria-hidden />
          </Link>
          <AccountMenu />
        </header>
        <main id="main" className="mx-auto max-w-[84rem] px-4 py-6 sm:px-6 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function ShellSearch({ path, placeholder }: { path: string; placeholder?: string }) {
  const [q, setQ] = useState('')
  const navigate = useNavigate()
  const submit = (e: FormEvent) => {
    e.preventDefault()
    navigate(q.trim() ? `${path}?q=${encodeURIComponent(q.trim())}` : path)
  }
  return (
    <form role="search" onSubmit={submit} className="relative max-w-md flex-1">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder ?? 'Search…'} aria-label={placeholder ?? 'Search'} className="h-10 w-full rounded-lg border border-line bg-canvas pl-9 pr-3 text-sm focus:border-brand-500 focus:bg-surface focus:outline-none focus:ring-4 focus:ring-brand-100" />
    </form>
  )
}
