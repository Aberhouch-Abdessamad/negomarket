import { ArrowRight, BadgeCheck, Handshake, MessagesSquare, ShieldCheck, ShoppingBag, Store } from 'lucide-react'
import { Link } from 'react-router'
import { CategoryIcon } from '@/components/layout/CategoryIcon'
import { tileTints } from '@/components/layout/categoryIcons'
import { Alert, Button, Skeleton } from '@/components/ui'
import { StoreCard } from '@/features/stores/components/StoreCard'
import { useAsync } from '@/hooks/useAsync'
import { cn } from '@/utils/cn'
import { HeroCarousel } from '../components/HeroCarousel'
import { ProductGrid } from '../components/ProductGrid'
import { ProductRail } from '../components/ProductRail'
import { SectionHeader } from '../components/SectionHeader'
import { marketplaceService } from '../marketplaceService'

export default function HomePage() {
  const { data, loading, error, reload } = useAsync(() => marketplaceService.home(), [])
  const categories = data?.categories.filter((c) => (c.products_count ?? 0) > 0)

  return (
    <div className="mx-auto max-w-[90rem] space-y-12 px-4 pt-5 lg:px-8 lg:pt-6">
      {/* Hero + promo cards */}
      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <HeroCarousel />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <Link to="/products?negotiable=1" className="group relative overflow-hidden rounded-2xl bg-accent-100 p-6 ring-1 ring-accent-200">
            <Handshake className="absolute -right-4 -top-4 size-32 text-accent-200" aria-hidden />
            <p className="relative text-xs font-bold uppercase tracking-widest text-accent-700">Deals by negotiation</p>
            <p className="relative mt-2 text-2xl font-extrabold leading-tight text-ink">{data ? data.stats.negotiable_products.toLocaleString() : '…'} products<br />open to offers</p>
            <span className="relative mt-4 inline-flex items-center gap-1 text-sm font-bold text-accent-700 group-hover:gap-2">Make an offer <ArrowRight className="size-4" aria-hidden /></span>
          </Link>
          <Link to="/sell" className="group relative overflow-hidden rounded-2xl bg-brand-950 p-6 text-white">
            <Store className="absolute -right-4 -top-4 size-32 text-white/5" aria-hidden />
            <p className="relative text-xs font-bold uppercase tracking-widest text-accent-400">For sellers</p>
            <p className="relative mt-2 text-2xl font-extrabold leading-tight">Open your store on NegoMarket</p>
            <span className="relative mt-4 inline-flex items-center gap-1 text-sm font-bold text-accent-400 group-hover:gap-2">Start selling <ArrowRight className="size-4" aria-hidden /></span>
          </Link>
        </div>
      </div>

      {/* Stats strip */}
      {data && (
        <dl className="grid grid-cols-3 divide-x divide-line rounded-2xl border border-line bg-surface py-4 text-center">
          {[
            [data.stats.products, 'products'],
            [data.stats.stores, 'independent stores'],
            [data.stats.negotiable_products, 'open to offers'],
          ].map(([n, label]) => (
            <div key={label as string} className="px-2">
              <dt className="sr-only">{label}</dt>
              <dd><span className="block text-2xl font-extrabold text-brand-700">{(n as number).toLocaleString()}</span><span className="text-xs text-ink-muted sm:text-sm">{label}</span></dd>
            </div>
          ))}
        </dl>
      )}

      {error && (
        <Alert tone="danger" title="Could not load the marketplace" action={<Button size="sm" variant="secondary" onClick={reload}>Retry</Button>}>{error.message}</Alert>
      )}

      {/* Categories */}
      <section>
        <SectionHeader title="Shop by category" to="/categories" linkLabel="All categories" />
        <ul className="scrollbar-none -mx-4 flex gap-3 overflow-x-auto px-4 lg:mx-0 lg:grid lg:grid-cols-6 lg:px-0">
          {loading && !data
            ? Array.from({ length: 6 }, (_, i) => <li key={i} className="w-36 shrink-0 lg:w-auto"><Skeleton className="h-32" /></li>)
            : categories?.map((c, i) => (
                  <li key={c.id} className="w-36 shrink-0 lg:w-auto">
                    <Link to={`/categories/${c.slug}`} className="group flex h-full flex-col items-center rounded-2xl border border-line bg-surface p-4 text-center transition hover:border-brand-200 hover:shadow-[var(--shadow-pop)]">
                      <span className={cn('grid size-14 place-items-center rounded-2xl transition group-hover:scale-105', tileTints[i % tileTints.length])}><CategoryIcon slug={c.slug} className="size-7" /></span>
                      <span className="mt-3 text-sm font-bold">{c.name}</span>
                      <span className="text-xs text-ink-subtle">{c.products_count} {c.products_count === 1 ? 'product' : 'products'}</span>
                    </Link>
                  </li>
              ))}
        </ul>
      </section>

      {/* Negotiable rail */}
      {(loading || (data?.negotiable.length ?? 0) > 0) && (
        <section className="rounded-3xl bg-linear-to-br from-accent-50 to-accent-100/60 p-5 ring-1 ring-accent-200 sm:p-8">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="inline-flex items-center gap-1.5 rounded-full bg-accent-400 px-2.5 py-1 text-xs font-bold text-ink"><Handshake className="size-3.5" aria-hidden /> Open to offers</p>
              <h2 className="mt-2 text-2xl font-extrabold tracking-tight">Make an offer on these</h2>
              <p className="text-sm text-ink-muted">Sellers accept negotiation on these products. Propose your price.</p>
            </div>
            <Link to="/products?negotiable=1" className="inline-flex items-center gap-1 rounded-lg bg-ink px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-950">Browse all <ArrowRight className="size-4" aria-hidden /></Link>
          </div>
          <ProductRail products={data?.negotiable} loading={loading} label="Products open to offers" />
        </section>
      )}

      {(loading || (data?.featured.length ?? 0) > 0) && (
        <section>
          <SectionHeader title="Featured products" subtitle="Hand-picked by our sellers" to="/products?sort=popular" />
          <ProductGrid products={data?.featured} loading={loading} columns={4} skeletons={5} />
        </section>
      )}

      {/* How it works */}
      <section className="overflow-hidden rounded-3xl bg-brand-950 text-white">
        <div className="pattern-grid grid gap-8 p-8 sm:p-10 lg:grid-cols-[1fr_2fr] lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-400">How negotiation works</p>
            <h2 className="mt-2 text-3xl font-extrabold leading-tight">Agree on a price in three steps</h2>
          </div>
          <ol className="grid gap-4 sm:grid-cols-3">
            {[
              { icon: Handshake, t: 'Make an offer', d: 'Propose your price on any product marked “Negotiable”.' },
              { icon: MessagesSquare, t: 'Chat & counter', d: 'The seller accepts, rejects or sends a counter-offer.' },
              { icon: ShieldCheck, t: 'Checkout at your price', d: 'The accepted price is locked in. Pay cash on delivery.' },
            ].map(({ icon: Icon, t, d }, i) => (
              <li key={t} className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
                <span className="flex items-center gap-2"><span className="grid size-7 place-items-center rounded-full bg-accent-400 text-xs font-extrabold text-ink">{i + 1}</span><Icon className="size-5 text-accent-400" aria-hidden /></span>
                <p className="mt-3 font-bold">{t}</p>
                <p className="mt-1 text-sm text-brand-200">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section>
        <SectionHeader title="Just added" subtitle="The newest listings on NegoMarket" to="/products?sort=newest" />
        <ProductRail products={data?.latest} loading={loading} label="New arrivals" />
      </section>

      {(data?.popular.length ?? 0) > 0 && (
        <section>
          <SectionHeader title="Popular right now" to="/products?sort=popular" />
          <ProductRail products={data?.popular} label="Popular products" />
        </section>
      )}

      {(data?.stores.length ?? 0) > 0 && (
        <section>
          <SectionHeader title="Featured stores" subtitle="Approved, independent sellers" to="/stores" linkLabel="All stores" />
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data?.stores.map((s) => <li key={s.id}><StoreCard store={s} /></li>)}
          </ul>
        </section>
      )}

      <section className="grid items-center gap-6 rounded-3xl border border-line bg-surface p-8 sm:grid-cols-[auto_1fr_auto] sm:p-10">
        <span className="grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand-700"><BadgeCheck className="size-7" aria-hidden /></span>
        <div>
          <h2 className="text-xl font-extrabold">Sell to customers who are ready to buy</h2>
          <p className="mt-1 max-w-2xl text-ink-muted">Open your store, set a private minimum price and let customers make offers. Approval takes one review.</p>
        </div>
        <Link to="/sell" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-accent-400 px-6 text-sm font-bold text-ink hover:bg-accent-500"><ShoppingBag className="size-4" aria-hidden /> Become a seller</Link>
      </section>
    </div>
  )
}
