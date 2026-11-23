import { ArrowRight, Handshake, Store } from 'lucide-react'
import { Link } from 'react-router'
import { Badge, Modal, Skeleton } from '@/components/ui'
import { useAsync } from '@/hooks/useAsync'
import { formatPrice } from '@/utils/format'
import { marketplaceService } from '../marketplaceService'
import type { ProductCard } from '../types'
import { RatingStars } from './RatingStars'

export function QuickViewModal({ product, onClose }: { product: ProductCard | null; onClose: () => void }) {
  return (
    <Modal open={product !== null} onClose={onClose} title={product?.name ?? ''} size="lg">
      {product && <QuickViewBody product={product} />}
    </Modal>
  )
}

function QuickViewBody({ product }: { product: ProductCard }) {
  const { data, loading } = useAsync(() => marketplaceService.product(product.slug), [product.slug])
  const detail = data?.product

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div className="aspect-square overflow-hidden rounded-xl bg-canvas">
        {product.image_url && <img src={detail?.images[0]?.url ?? product.image_url} alt="" className="size-full object-cover" />}
      </div>
      <div className="flex flex-col">
        <p className="text-2xl font-semibold">{formatPrice(product.price_from)}</p>
        <RatingStars value={product.rating_avg} count={product.rating_count} className="mt-2" />
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Badge tone={product.in_stock ? 'success' : 'danger'}>{product.in_stock ? 'In stock' : 'Out of stock'}</Badge>
          {product.allow_negotiation && (
            <Badge tone="warning">
              <Handshake className="size-3" aria-hidden /> Negotiable
            </Badge>
          )}
        </div>
        {loading && !detail ? (
          <div className="mt-4 space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
          </div>
        ) : (
          <p className="mt-4 line-clamp-5 text-sm leading-relaxed text-ink-muted">{detail?.description}</p>
        )}
        {product.store && (
          <p className="mt-4 flex items-center gap-1.5 text-sm text-ink-muted">
            <Store className="size-4" aria-hidden /> Sold by <span className="font-medium text-ink">{product.store.name}</span>
          </p>
        )}
        <Link to={`/products/${product.slug}`} className="mt-auto inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 pt-0 text-sm font-medium text-white hover:bg-brand-700 sm:mt-6">
          View full details <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    </div>
  )
}
