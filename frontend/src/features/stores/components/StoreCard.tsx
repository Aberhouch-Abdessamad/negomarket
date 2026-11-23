import { Handshake, MapPin, Package } from 'lucide-react'
import { Link } from 'react-router'
import { RatingStars } from '@/features/marketplace/components/RatingStars'
import type { StoreProfile } from '@/features/marketplace/types'
import { pluralize } from '@/utils/format'

export function StoreCard({ store }: { store: StoreProfile }) {
  return (
    <Link to={`/stores/${store.slug}`} className="group block overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="h-24 bg-brand-100">{store.banner_url && <img src={store.banner_url} alt="" loading="lazy" className="size-full object-cover" />}</div>
      <div className="relative px-5 pb-5">
        <div className="-mt-8 mb-3 size-16 overflow-hidden rounded-2xl border-4 border-surface bg-surface shadow-sm">
          {store.logo_url ? <img src={store.logo_url} alt="" className="size-full object-cover" /> : <span className="grid size-full place-items-center bg-brand-600 text-xl font-extrabold text-white">{store.name[0]}</span>}
        </div>
        <h3 className="font-semibold group-hover:text-brand-700">{store.name}</h3>
        <RatingStars value={store.rating_avg} count={store.rating_count} className="mt-1" />
        {store.description && <p className="mt-2 line-clamp-2 text-sm text-ink-muted">{store.description}</p>}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-subtle">
          {store.city && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" aria-hidden /> {store.city}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Package className="size-3.5" aria-hidden /> {pluralize(store.products_count, 'product')}
          </span>
          {!!store.negotiable_products_count && (
            <span className="inline-flex items-center gap-1 text-accent-600">
              <Handshake className="size-3.5" aria-hidden /> {store.negotiable_products_count} negotiable
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
