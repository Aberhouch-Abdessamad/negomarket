import { Eye, Handshake, ImageOff } from 'lucide-react'
import { Link } from 'react-router'
import { cn } from '@/utils/cn'
import { formatPrice } from '@/utils/format'
import type { ProductCard as Card } from '../types'
import { RatingStars } from './RatingStars'
import { WishlistButton } from './WishlistButton'

export function ProductCard({ product, onQuickView, className }: { product: Card; onQuickView?: (p: Card) => void; className?: string }) {
  const from = product.has_variants && product.price_from < product.price

  return (
    <article className={cn('group relative flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface transition duration-200 hover:border-brand-200 hover:shadow-[var(--shadow-pop)]', className)}>
      <Link to={`/products/${product.slug}`} className="relative block aspect-square overflow-hidden bg-canvas" aria-label={product.name}>
        {product.image_url ? (
          <img src={product.image_url} alt="" loading="lazy" className="size-full object-cover transition duration-500 group-hover:scale-[1.04]" />
        ) : (
          <span className="grid size-full place-items-center text-ink-subtle"><ImageOff className="size-8" aria-hidden /></span>
        )}
        {!product.in_stock && <span className="absolute inset-0 grid place-items-center bg-white/60 text-xs font-bold uppercase tracking-wider text-ink backdrop-blur-[1px]">Out of stock</span>}
      </Link>

      <div className="pointer-events-none absolute left-2.5 top-2.5 flex flex-col items-start gap-1">
        {product.allow_negotiation && (
          <span className="inline-flex items-center gap-1 rounded-md bg-accent-400 px-1.5 py-0.5 text-[11px] font-bold text-ink shadow-sm">
            <Handshake className="size-3" aria-hidden /> Negotiable
          </span>
        )}
        {product.featured && <span className="rounded-md bg-brand-600 px-1.5 py-0.5 text-[11px] font-bold text-white shadow-sm">Featured</span>}
      </div>
      <div className="absolute right-2.5 top-2.5 flex flex-col gap-1.5">
        <WishlistButton productId={product.id} />
        {onQuickView && (
          <button
            type="button"
            onClick={() => onQuickView(product)}
            aria-label={`Quick view ${product.name}`}
            className="grid size-9 place-items-center rounded-full bg-surface/95 opacity-0 shadow-sm ring-1 ring-line transition group-hover:opacity-100 focus:opacity-100"
          >
            <Eye className="size-4 text-ink-muted" />
          </button>
        )}
      </div>

      <div className="flex flex-1 flex-col p-3 sm:p-3.5">
        {product.store && (
          <Link to={`/stores/${product.store.slug}`} className="truncate text-[11px] font-semibold uppercase tracking-wide text-ink-subtle hover:text-brand-700">
            {product.store.name}
          </Link>
        )}
        <h3 className="mt-1 line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-ink">
          <Link to={`/products/${product.slug}`} className="hover:text-brand-700">{product.name}</Link>
        </h3>
        <RatingStars value={product.rating_avg} count={product.rating_count} className="mt-1.5" />
        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          <p className="leading-none">
            {from && <span className="block pb-1 text-[11px] font-medium text-ink-subtle">From</span>}
            <span className="text-lg font-extrabold tracking-tight text-ink">{formatPrice(product.price_from)}</span>
          </p>
        </div>
      </div>
    </article>
  )
}
