import { Banknote, Handshake, Heart, Menu, ShoppingCart, Sparkles, Star, Store, Truck } from 'lucide-react'
import { Link, NavLink } from 'react-router'
import { SearchBox } from '@/features/marketplace/components/SearchBox'
import { useCategories } from '@/hooks/useCategories'
import { useAuthStore } from '@/store/authStore'
import { useCartStore } from '@/store/cartStore'
import { useUiStore } from '@/store/uiStore'
import { useWishlistStore } from '@/store/wishlistStore'
import { cn } from '@/utils/cn'
import { AccountMenu } from './AccountMenu'
import { Logo } from './Logo'
import { MegaMenu } from './MegaMenu'
import { MobileNav } from './MobileNav'
import { NegotiationBell } from './NegotiationBell'

const quickLinks = [
  { to: '/products?negotiable=1', label: 'Open to offers', icon: Handshake, highlight: true },
  { to: '/products?sort=newest', label: 'New arrivals', icon: Sparkles },
  { to: '/products?sort=rating', label: 'Top rated', icon: Star },
  { to: '/stores', label: 'Stores', icon: Store },
  { to: '/categories', label: 'Categories' },
]

export function StorefrontHeader() {
  const categories = useCategories()
  const authed = useAuthStore((s) => s.status === 'authenticated')
  const wishlistCount = useWishlistStore((s) => s.ids.size)
  const cartCount = useCartStore((s) => s.summary?.total_quantity ?? 0)
  const { mobileNavOpen, toggleMobileNav } = useUiStore()

  return (
    <header className="sticky top-0 z-40 bg-surface shadow-[0_1px_0_var(--color-line)]">
      {/* Utility strip */}
      <div className="hidden bg-brand-950 text-[13px] text-brand-100 sm:block">
        <div className="mx-auto flex h-9 max-w-[90rem] items-center justify-between px-4 lg:px-8">
          <p className="flex items-center gap-5">
            <span className="flex items-center gap-1.5"><Banknote className="size-3.5 text-accent-400" aria-hidden /> Cash on Delivery everywhere</span>
            <span className="hidden items-center gap-1.5 md:flex"><Handshake className="size-3.5 text-accent-400" aria-hidden /> Negotiate prices with sellers</span>
            <span className="hidden items-center gap-1.5 lg:flex"><Truck className="size-3.5 text-accent-400" aria-hidden /> Delivered by independent stores</span>
          </p>
          <nav aria-label="Utility" className="flex items-center gap-5">
            <Link to="/sell" className="font-semibold text-accent-400 hover:text-accent-200">Sell on NegoMarket</Link>
            <Link to="/stores" className="hover:text-white">Store directory</Link>
          </nav>
        </div>
      </div>

      {/* Main bar */}
      <div className="mx-auto flex max-w-[90rem] items-center gap-3 px-4 py-3 lg:gap-8 lg:px-8">
        <button type="button" onClick={toggleMobileNav} aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'} aria-expanded={mobileNavOpen} className="-ml-1 rounded-lg p-2 text-ink hover:bg-canvas lg:hidden">
          <Menu className="size-6" />
        </button>
        <Logo />
        <SearchBox className="hidden flex-1 md:block" categories={categories} />
        <div className="ml-auto flex items-center gap-1 md:ml-0">
          <AccountMenu />
          {authed && <NegotiationBell />}
          {authed && (
            <Link to="/wishlist" className="relative flex items-center gap-2 rounded-lg p-2 text-ink hover:bg-canvas" aria-label={`Wishlist (${wishlistCount})`}>
              <Heart className="size-6" />
              {wishlistCount > 0 && <span className="absolute right-0.5 top-0.5 grid min-w-[18px] place-items-center rounded-full bg-accent-400 px-1 text-[10px] font-bold text-ink">{wishlistCount}</span>}
            </Link>
          )}
          {authed && (
            <Link to="/cart" className="relative flex items-center gap-2 rounded-lg p-2 text-ink hover:bg-canvas" aria-label={`Cart (${cartCount})`}>
              <span className="relative">
                <ShoppingCart className="size-6" />
                {cartCount > 0 && <span className="absolute -right-2 -top-2 grid min-w-[18px] place-items-center rounded-full bg-brand-600 px-1 text-[10px] font-bold text-white">{cartCount > 99 ? '99+' : cartCount}</span>}
              </span>
              <span className="hidden text-sm font-bold xl:block">Cart</span>
            </Link>
          )}
        </div>
      </div>
      <div className="px-4 pb-3 md:hidden">
        <SearchBox />
      </div>

      {/* Category bar */}
      <div className="hidden border-t border-line lg:block">
        <div className="mx-auto flex max-w-[90rem] items-center gap-2 px-8 py-1.5">
          <MegaMenu categories={categories} />
          <nav aria-label="Main" className="flex items-center gap-1">
            {quickLinks.map(({ to, label, icon: Icon, highlight }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    'inline-flex h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors',
                    highlight ? 'text-accent-700 hover:bg-accent-50' : isActive ? 'text-brand-700' : 'text-ink hover:bg-canvas',
                  )
                }
              >
                {Icon && <Icon className="size-4" aria-hidden />}
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1 overflow-hidden">
            {categories?.slice(0, 4).map((c) => (
              <Link key={c.id} to={`/categories/${c.slug}`} className="hidden h-11 items-center rounded-lg px-3 text-sm text-ink-muted hover:text-ink xl:inline-flex">
                {c.name}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <MobileNav categories={categories} />
    </header>
  )
}
