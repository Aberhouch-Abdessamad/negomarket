import { ChevronDown, Handshake, Heart, LayoutGrid, LogIn, Sparkles, Store, UserRound, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router'
import type { Category } from '@/features/marketplace/types'
import { useAuthStore } from '@/store/authStore'
import { useUiStore } from '@/store/uiStore'
import { cn } from '@/utils/cn'
import { categoryIcon } from './categoryIcons'
import { Logo } from './Logo'

/** Off-canvas navigation for phones and tablets. */
export function MobileNav({ categories }: { categories: Category[] | null }) {
  const { mobileNavOpen: open, closeMobileNav: close } = useUiStore()
  const { user, status } = useAuthStore()
  const [expanded, setExpanded] = useState<number | null>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, close])

  if (!open) return null

  const item = 'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold hover:bg-canvas'

  return createPortal(
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={close} aria-hidden />
      <nav aria-label="Mobile" className="absolute inset-y-0 left-0 flex w-[min(22rem,88vw)] flex-col bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <Logo onClick={close} />
          <button type="button" onClick={close} aria-label="Close menu" className="rounded-lg p-2 hover:bg-canvas"><X className="size-5" /></button>
        </div>
        <div className="border-b border-line bg-brand-950 px-4 py-4 text-white">
          {status === 'authenticated' && user ? (
            <Link to="/account/profile" onClick={close} className="flex items-center gap-3">
              <UserRound className="size-5 text-accent-400" aria-hidden />
              <span><span className="block text-xs text-brand-200">Hello,</span><span className="font-semibold">{user.name}</span></span>
            </Link>
          ) : (
            <Link to="/login" onClick={close} className="flex items-center gap-3 font-semibold"><LogIn className="size-5 text-accent-400" aria-hidden /> Sign in or create an account</Link>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <Link to="/products?negotiable=1" onClick={close} className={cn(item, 'text-accent-700')}><Handshake className="size-4" /> Open to offers</Link>
          <Link to="/products?sort=newest" onClick={close} className={item}><Sparkles className="size-4" /> New arrivals</Link>
          <Link to="/products" onClick={close} className={item}><LayoutGrid className="size-4" /> All products</Link>
          <Link to="/stores" onClick={close} className={item}><Store className="size-4" /> Stores</Link>
          {status === 'authenticated' && <Link to="/wishlist" onClick={close} className={item}><Heart className="size-4" /> Wishlist</Link>}

          <p className="mt-4 px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-ink-subtle">Shop by category</p>
          <ul>
            {categories?.map((c) => {
              const Icon = categoryIcon(c.slug)
              const isOpen = expanded === c.id
              return (
                <li key={c.id}>
                  <button type="button" aria-expanded={isOpen} onClick={() => setExpanded(isOpen ? null : c.id)} className={cn(item, 'w-full')}>
                    <Icon className="size-4 text-brand-700" aria-hidden />
                    <span className="flex-1 text-left">{c.name}</span>
                    <ChevronDown className={cn('size-4 text-ink-subtle transition', isOpen && 'rotate-180')} aria-hidden />
                  </button>
                  {isOpen && (
                    <ul className="mb-2 ml-9 border-l border-line pl-2">
                      <li><Link to={`/categories/${c.slug}`} onClick={close} className="block rounded-lg px-3 py-2 text-sm font-semibold text-brand-700">All {c.name}</Link></li>
                      {c.children?.map((ch) => (
                        <li key={ch.id}><Link to={`/categories/${ch.slug}`} onClick={close} className="block rounded-lg px-3 py-2 text-sm text-ink-muted hover:text-ink">{ch.name}</Link></li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
        <div className="border-t border-line p-4">
          <Link to="/sell" onClick={close} className="flex items-center justify-center gap-2 rounded-xl bg-accent-400 py-3 text-sm font-bold text-ink">
            <Store className="size-4" aria-hidden /> Sell on NegoMarket
          </Link>
        </div>
      </nav>
    </div>,
    document.body,
  )
}
