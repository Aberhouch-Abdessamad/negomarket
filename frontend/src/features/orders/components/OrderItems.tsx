import { Package } from 'lucide-react'
import { Link } from 'react-router'
import type { OrderItem } from '../types'
import { formatPrice } from '@/utils/format'

/** Snapshot lines from an order. Prices are the API's stored values. */
export function OrderItems({ items }: { items: OrderItem[] }) {
  return (
    <ul className="divide-y divide-line">
      {items.map((item) => (
        <li key={item.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
          <span className="size-12 shrink-0 overflow-hidden rounded-xl bg-canvas">
            {item.thumbnail_url ? (
              <img src={item.thumbnail_url} alt="" className="size-full object-cover" />
            ) : (
              <span className="grid size-full place-items-center text-ink-subtle">
                <Package className="size-5" aria-hidden />
              </span>
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">
              {item.product_slug ? (
                <Link to={`/products/${item.product_slug}`} className="hover:text-brand-700">
                  {item.product_name}
                </Link>
              ) : (
                item.product_name
              )}
            </span>
            <span className="mt-0.5 block text-xs text-ink-subtle">
              {item.variant_attributes ? `${Object.values(item.variant_attributes).join(' / ')} · ` : ''}
              Qty {item.quantity}
              {item.is_negotiated ? ' · agreed price' : ''}
            </span>
          </span>
          <span className="text-right text-sm">
            <span className="block font-semibold">{formatPrice(item.total_price)}</span>
            {item.quantity > 1 && <span className="text-xs text-ink-subtle">{formatPrice(item.unit_price)} each</span>}
          </span>
        </li>
      ))}
    </ul>
  )
}
