import { Star } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Button, Checkbox } from '@/components/ui'
import { cn } from '@/utils/cn'
import type { Category, ProductFilters } from '../types'

interface Props {
  filters: ProductFilters
  categories?: Category[]
  hideCategory?: boolean
  onChange: (patch: Partial<ProductFilters>) => void
  onReset: () => void
}

export function FilterPanel({ filters, categories, hideCategory, onChange, onReset }: Props) {
  // Keyed by the URL values so the inputs reset when filters change elsewhere.
  return <FilterPanelInner key={`${filters.min_price}-${filters.max_price}`} {...{ filters, categories, hideCategory, onChange, onReset }} />
}

function FilterPanelInner({ filters, categories, hideCategory, onChange, onReset }: Props) {
  const [min, setMin] = useState(filters.min_price ?? '')
  const [max, setMax] = useState(filters.max_price ?? '')

  const applyPrice = (e: FormEvent) => {
    e.preventDefault()
    onChange({ min_price: min || undefined, max_price: max || undefined })
  }

  return (
    <div className="divide-y divide-line [&>*]:py-5 [&>*:first-child]:pt-0 [&>*:last-child]:pb-0">
      {!hideCategory && categories && (
        <section>
          <h3 className="mb-3 text-sm font-bold">Category</h3>
          <ul className="space-y-0.5 text-sm">
            <li>
              <button type="button" onClick={() => onChange({ category: undefined })} className={cn('w-full rounded-lg px-2.5 py-1.5 text-left', !filters.category ? 'bg-brand-50 font-semibold text-brand-800' : 'text-ink-muted hover:bg-canvas')}>
                All categories
              </button>
            </li>
            {categories.map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => onChange({ category: c.slug })} className={cn('flex w-full justify-between rounded-lg px-2.5 py-1.5 text-left', filters.category === c.slug ? 'bg-brand-50 font-semibold text-brand-800' : 'text-ink hover:bg-canvas')}>
                  {c.name} <span className="text-xs text-ink-subtle">{c.products_count}</span>
                </button>
                {c.children && c.children.length > 0 && (filters.category === c.slug || c.children.some((ch) => ch.slug === filters.category)) && (
                  <ul className="ml-3 mt-0.5 space-y-0.5 border-l border-line pl-2">
                    {c.children.map((ch) => (
                      <li key={ch.id}>
                        <button type="button" onClick={() => onChange({ category: ch.slug })} className={cn('flex w-full justify-between rounded-lg px-2.5 py-1 text-left', filters.category === ch.slug ? 'font-medium text-brand-700' : 'text-ink-muted hover:text-ink')}>
                          {ch.name} <span className="text-xs text-ink-subtle">{ch.products_count}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3 className="mb-3 text-sm font-bold">Price (MAD)</h3>
        <form onSubmit={applyPrice} className="flex items-center gap-2">
          <input aria-label="Minimum price" inputMode="numeric" placeholder="Min" value={min} onChange={(e) => setMin(e.target.value.replace(/[^0-9.]/g, ''))} className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100" />
          <span className="text-ink-subtle">–</span>
          <input aria-label="Maximum price" inputMode="numeric" placeholder="Max" value={max} onChange={(e) => setMax(e.target.value.replace(/[^0-9.]/g, ''))} className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100" />
          <Button type="submit" variant="secondary" size="sm" className="h-10">
            Go
          </Button>
        </form>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-bold">Availability</h3>
        <Checkbox label="Negotiation available" checked={filters.negotiable === '1'} onChange={(e) => onChange({ negotiable: e.target.checked ? '1' : undefined })} />
        <Checkbox label="In stock only" checked={filters.in_stock === '1'} onChange={(e) => onChange({ in_stock: e.target.checked ? '1' : undefined })} />
      </section>

      <section>
        <h3 className="mb-3 text-sm font-bold">Customer rating</h3>
        <div className="space-y-1">
          {[4, 3, 2].map((r) => (
            <button key={r} type="button" aria-pressed={filters.min_rating === String(r)} onClick={() => onChange({ min_rating: filters.min_rating === String(r) ? undefined : String(r) })} className={cn('flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm', filters.min_rating === String(r) ? 'bg-brand-50 text-brand-700' : 'text-ink-muted hover:bg-canvas')}>
              <span className="flex" aria-hidden>
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} className={cn('size-3.5', i <= r ? 'fill-accent-500 text-accent-500' : 'fill-line text-line')} />
                ))}
              </span>
              &amp; up
            </button>
          ))}
        </div>
      </section>

      <Button variant="ghost" size="sm" onClick={onReset} className="w-full">
        Clear all filters
      </Button>
    </div>
  )
}
