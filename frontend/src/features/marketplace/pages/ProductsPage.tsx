import { PackageSearch, SlidersHorizontal, X } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { Alert, Button, EmptyState, Modal, Pagination, Select } from '@/components/ui'
import { useAsync } from '@/hooks/useAsync'
import { FilterPanel } from '../components/FilterPanel'
import { ProductGrid } from '../components/ProductGrid'
import { marketplaceService } from '../marketplaceService'
import type { ProductFilters, ProductSort } from '../types'
import { useProductFilters } from '../useProductFilters'
import { CategoryIcon } from '@/components/layout/CategoryIcon'

const SORTS: { value: ProductSort; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'popular', label: 'Most popular' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'rating', label: 'Top rated' },
]

/** Marketplace listing (/products) and category listing (/categories/:slug). */
export default function ProductsPage() {
  const { slug } = useParams()
  const { filters, update, reset, activeCount } = useProductFilters(slug ? { category: slug } : {})
  const [filtersOpen, setFiltersOpen] = useState(false)

  const products = useAsync(() => marketplaceService.products({ ...filters, per_page: '24' }), [JSON.stringify(filters)])
  const categories = useAsync(() => marketplaceService.categories(), [])
  const category = useAsync(() => (slug ? marketplaceService.category(slug) : Promise.resolve(null)), [slug])

  const title = filters.q ? `Results for “${filters.q}”` : (category.data?.name ?? 'Marketplace')
  const meta = products.data?.meta

  const panel = <FilterPanel filters={filters} categories={categories.data} hideCategory={Boolean(slug)} onChange={update} onReset={reset} />

  type Chip = { key: keyof ProductFilters; label: string }
  const chips = ([
    filters.q ? { key: 'q', label: `“${filters.q}”` } : null,
    !slug && filters.category ? { key: 'category', label: categories.data?.flatMap((c) => [c, ...(c.children ?? [])]).find((c) => c.slug === filters.category)?.name ?? filters.category } : null,
    filters.negotiable ? { key: 'negotiable', label: 'Open to offers' } : null,
    filters.in_stock ? { key: 'in_stock', label: 'In stock' } : null,
    filters.min_rating ? { key: 'min_rating', label: `${filters.min_rating}★ & up` } : null,
    filters.min_price ? { key: 'min_price', label: `From ${filters.min_price} MAD` } : null,
    filters.max_price ? { key: 'max_price', label: `Up to ${filters.max_price} MAD` } : null,
  ] as (Chip | null)[]).filter((c): c is Chip => c !== null)

  return (
    <div>
      <div className="border-b border-line bg-surface">
        <div className="mx-auto max-w-[90rem] px-4 py-6 lg:px-8">
          <nav aria-label="Breadcrumb" className="mb-3 flex flex-wrap items-center gap-1.5 text-sm text-ink-subtle">
            <Link to="/" className="hover:text-ink">Home</Link> <span aria-hidden>›</span>
            {slug ? (
              <>
                <Link to="/categories" className="hover:text-ink">Categories</Link>
                {category.data?.parent && (
                  <>
                    <span aria-hidden>›</span>
                    <Link to={`/categories/${category.data.parent.slug}`} className="hover:text-ink">{category.data.parent.name}</Link>
                  </>
                )}
              </>
            ) : (
              <span>Marketplace</span>
            )}
          </nav>
          <div className="flex items-center gap-4">
            {slug && <span className="hidden size-14 place-items-center rounded-2xl bg-brand-50 text-brand-700 sm:grid"><CategoryIcon slug={slug ?? ''} className="size-7" /></span>}
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
              {meta && <p className="mt-0.5 text-sm text-ink-muted" aria-live="polite">{meta.total.toLocaleString()} {meta.total === 1 ? 'product' : 'products'}</p>}
            </div>
          </div>
          {category.data?.children && category.data.children.length > 0 && (
            <div className="scrollbar-none -mx-4 mt-5 flex gap-2 overflow-x-auto px-4">
              {category.data.children.map((c) => (
                  <Link key={c.id} to={`/categories/${c.slug}`} className="inline-flex shrink-0 items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800">
                    <CategoryIcon slug={c.slug} className="size-4 text-brand-700" /> {c.name}
                  </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto grid max-w-[90rem] gap-6 px-4 py-6 lg:grid-cols-[16.5rem_1fr] lg:px-8">
        <aside className="hidden lg:block" aria-label="Filters">
          <div className="sticky top-44 rounded-2xl border border-line bg-surface p-5">
            <p className="mb-5 flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide"><SlidersHorizontal className="size-4" aria-hidden /> Filters</p>
            {panel}
          </div>
        </aside>
        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface p-2.5">
            <Button variant="secondary" size="sm" className="lg:hidden" leftIcon={<SlidersHorizontal className="size-4" />} onClick={() => setFiltersOpen(true)}>
              Filters{activeCount > 0 && ` (${activeCount})`}
            </Button>
            <div className="flex flex-1 flex-wrap gap-1.5">
              {chips.map((c) => (
                <button key={c.key} type="button" onClick={() => update({ [c.key]: undefined })} className="inline-flex items-center gap-1 rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs font-semibold text-brand-800 ring-1 ring-brand-200 hover:bg-brand-100" aria-label={`Remove filter ${c.label}`}>
                  {c.label} <X className="size-3.5" aria-hidden />
                </button>
              ))}
              {chips.length > 1 && <button type="button" onClick={reset} className="px-2 text-xs font-semibold text-ink-muted hover:text-ink">Clear all</button>}
            </div>
            <label className="flex items-center gap-2 text-sm text-ink-muted">
              <span className="hidden sm:inline">Sort by</span>
              <span className="w-48"><Select aria-label="Sort by" value={filters.sort ?? 'newest'} options={SORTS} onChange={(e) => update({ sort: e.target.value as ProductSort })} className="h-9" /></span>
            </label>
          </div>
          {products.error && <Alert tone="danger" className="mb-6">{products.error.message}</Alert>}
          {products.data?.data.length === 0 ? (
            <EmptyState icon={PackageSearch} title="No products match your filters" message="Try removing some filters or searching for something else." action={<Button variant="secondary" onClick={reset}>Clear filters</Button>} />
          ) : (
            <ProductGrid products={products.data?.data} loading={products.loading} columns={3} skeletons={8} />
          )}
          {meta && (
            <div className="mt-10">
              <Pagination page={meta.current_page} lastPage={meta.last_page} onChange={(p) => { update({ page: String(p) }); window.scrollTo({ top: 0, behavior: 'smooth' }) }} />
            </div>
          )}
        </div>
      </div>

      <Modal open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filters">
        {panel}
      </Modal>
    </div>
  )
}
