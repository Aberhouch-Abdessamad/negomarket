import { CalendarDays, Handshake, MapPin, Package, PackageSearch } from 'lucide-react'
import { useParams } from 'react-router'
import { Alert, Button, EmptyState, Pagination, Select, Skeleton } from '@/components/ui'
import { ProductGrid } from '@/features/marketplace/components/ProductGrid'
import { RatingStars } from '@/features/marketplace/components/RatingStars'
import { marketplaceService } from '@/features/marketplace/marketplaceService'
import type { ProductSort } from '@/features/marketplace/types'
import { useProductFilters } from '@/features/marketplace/useProductFilters'
import { useAsync } from '@/hooks/useAsync'
import NotFoundPage from '@/pages/NotFoundPage'
import { formatDate, pluralize } from '@/utils/format'

export default function StorePage() {
  const { slug = '' } = useParams()
  const store = useAsync(() => marketplaceService.store(slug), [slug])
  const { filters, update, reset } = useProductFilters({ store: slug })
  const products = useAsync(() => marketplaceService.products({ ...filters, per_page: '12' }), [JSON.stringify(filters)])

  if (store.error?.status === 404) return <NotFoundPage />
  const s = store.data

  return (
    <div>
      <div className="h-40 bg-brand-100 sm:h-56">{s?.banner_url && <img src={s.banner_url} alt="" className="size-full object-cover" />}</div>
      <div className="mx-auto max-w-[90rem] px-4 lg:px-8">
        <div className="-mt-12 flex flex-col gap-5 sm:flex-row sm:items-end">
          <div className="size-24 overflow-hidden rounded-3xl border-4 border-surface bg-surface shadow-md">{s?.logo_url ? <img src={s.logo_url} alt="" className="size-full object-cover" /> : <Skeleton className="size-full" />}</div>
          <div className="flex-1 pb-1">
            {s ? <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{s.name}</h1> : <Skeleton className="h-8 w-64" />}
            {s && (
              <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-ink-muted">
                <RatingStars value={s.rating_avg} count={s.rating_count} />
                {s.city && <span className="inline-flex items-center gap-1"><MapPin className="size-4" aria-hidden /> {s.city}</span>}
                <span className="inline-flex items-center gap-1"><Package className="size-4" aria-hidden /> {pluralize(s.products_count, 'product')}</span>
                {!!s.negotiable_products_count && <span className="inline-flex items-center gap-1 text-accent-600"><Handshake className="size-4" aria-hidden /> {s.negotiable_products_count} open to offers</span>}
                <span className="inline-flex items-center gap-1"><CalendarDays className="size-4" aria-hidden /> Since {formatDate(s.member_since)}</span>
              </div>
            )}
          </div>
        </div>
        {s?.description && <p className="mt-5 max-w-3xl text-ink-muted">{s.description}</p>}
        {store.error && <Alert tone="danger" className="mt-6">{store.error.message}</Alert>}

        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
          <h2 className="text-lg font-semibold">Products</h2>
          <div className="flex gap-2">
            <Button size="sm" variant={filters.negotiable ? 'primary' : 'secondary'} leftIcon={<Handshake className="size-4" />} onClick={() => update({ negotiable: filters.negotiable ? undefined : '1' })}>
              Negotiable
            </Button>
            <div className="w-48">
              <Select aria-label="Sort by" value={filters.sort ?? 'newest'} onChange={(e) => update({ sort: e.target.value as ProductSort })} options={[{ value: 'newest', label: 'Newest' }, { value: 'popular', label: 'Most popular' }, { value: 'price_asc', label: 'Price: low to high' }, { value: 'price_desc', label: 'Price: high to low' }]} />
            </div>
          </div>
        </div>
        <div className="py-8">
          {products.data?.data.length === 0 ? (
            <EmptyState icon={PackageSearch} title="No products here yet" action={<Button variant="secondary" onClick={reset}>Clear filters</Button>} />
          ) : (
            <ProductGrid products={products.data?.data} loading={products.loading} />
          )}
          {products.data && <div className="mt-10"><Pagination page={products.data.meta.current_page} lastPage={products.data.meta.last_page} onChange={(p) => update({ page: String(p) })} /></div>}
        </div>
      </div>
    </div>
  )
}
