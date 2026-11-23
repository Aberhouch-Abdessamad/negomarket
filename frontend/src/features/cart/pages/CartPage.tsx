import { ArrowRight, Minus, Plus, ShoppingBag, Store, Trash2, Truck } from 'lucide-react'
import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router'
import { Alert, Badge, Button, Card, CardBody, EmptyState, Skeleton } from '@/components/ui'
import type { CartLine, CartSummary } from '@/features/cart/types'
import { useCartStore } from '@/store/cartStore'
import { formatPrice } from '@/utils/format'
import { cn } from '@/utils/cn'

/** Multi-vendor cart, grouped by store. Every amount comes from the API. */
export default function CartPage() {
  const summary = useCartStore((s) => s.summary)
  const loaded = useCartStore((s) => s.loaded)
  const load = useCartStore((s) => s.load)
  const navigate = useNavigate()

  useEffect(() => {
    void load()
  }, [load])

  if (!summary && !loaded) return <CartSkeleton />
  if (!summary || summary.item_count === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <EmptyState
          icon={ShoppingBag}
          title="Your cart is empty"
          message="Browse the marketplace or make an offer to a seller. Accepted offers appear here at the agreed price."
          action={<Link to="/products"><Button>Browse products</Button></Link>}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[90rem] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Shopping cart</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {summary.item_count} line{summary.item_count === 1 ? '' : 's'} from {summary.groups.length} store{summary.groups.length === 1 ? '' : 's'}
          </p>
        </div>
        <Link to="/products" className="text-sm font-medium text-brand-600 hover:text-brand-700">Continue shopping</Link>
      </div>

      {summary.has_issues && (
        <Alert tone="warning" className="mt-5" title="Some items need attention">
          Remove or fix the lines marked below before checking out.
        </Alert>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-5">
          {summary.groups.map((group) => (
            <Card key={group.store.id}>
              <div className="flex items-center gap-3 border-b border-line px-5 py-3.5">
                <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-canvas">
                  {group.store.logo_url ? <img src={group.store.logo_url} alt="" className="size-full object-cover" /> : <Store className="size-4 text-ink-subtle" />}
                </span>
                <div className="min-w-0 flex-1">
                  <Link to={`/stores/${group.store.slug}`} className="truncate font-semibold hover:text-brand-700">{group.store.name}</Link>
                  <p className="text-xs text-ink-subtle">Shipped by this store</p>
                </div>
                <span className="text-sm font-medium">{formatPrice(group.subtotal)}</span>
              </div>
              <ul className="divide-y divide-line">
                {group.items.map((line) => <CartLineRow key={line.id} line={line} />)}
              </ul>
              <div className="flex flex-wrap justify-between gap-2 border-t border-line bg-canvas/40 px-5 py-3 text-sm">
                <span className="inline-flex items-center gap-1 text-ink-subtle"><Truck className="size-3.5" aria-hidden /> Shipping {group.shipping_cost > 0 ? formatPrice(group.shipping_cost) : 'free'}</span>
                <span>Store total <strong>{formatPrice(group.total)}</strong></span>
              </div>
            </Card>
          ))}

          {summary.items.some((line) => !line.available) && (
            <div className="space-y-2">
              {summary.items.filter((line) => !line.available).map((line) => (
                <Alert key={line.id} tone="danger" title={line.product.name}>
                  <ul className="list-inside list-disc space-y-0.5">
                    {line.issues.map((issue) => <li key={issue}>{issue}</li>)}
                  </ul>
                  <button type="button" className="mt-2 text-xs font-semibold underline" onClick={() => void useCartStore.getState().remove(line.id)}>Remove this line</button>
                </Alert>
              ))}
            </div>
          )}
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card>
            <CardBody className="space-y-4">
              <h2 className="font-semibold">Order summary</h2>
              <Totals summary={summary} />
              <div className="rounded-xl bg-canvas p-3 text-xs text-ink-muted">
                <p className="inline-flex items-center gap-1.5 font-medium text-ink"><Truck className="size-3.5 text-brand-600" aria-hidden /> Cash on Delivery</p>
                <p className="mt-1">You pay the courier when your order arrives. One order is created per store.</p>
              </div>
              <Button
                size="lg"
                className="w-full"
                disabled={summary.has_issues || summary.item_count === 0}
                leftIcon={<ArrowRight className="size-5" />}
                onClick={() => navigate('/checkout')}
              >
                Proceed to checkout
              </Button>
              {summary.has_issues && <p className="text-center text-xs text-danger-600">Fix the highlighted items first.</p>}
            </CardBody>
          </Card>
        </aside>
      </div>
    </div>
  )
}

function Totals({ summary }: { summary: CartSummary }) {
  return (
    <dl className="space-y-1.5 text-sm">
      <div className="flex justify-between"><dt className="text-ink-muted">Subtotal</dt><dd>{formatPrice(summary.subtotal)}</dd></div>
      <div className="flex justify-between"><dt className="text-ink-muted">Shipping</dt><dd>{summary.shipping_total > 0 ? formatPrice(summary.shipping_total) : 'Free'}</dd></div>
      <div className="flex justify-between border-t border-line pt-2 text-base font-semibold"><dt>Total</dt><dd>{formatPrice(summary.total)}</dd></div>
    </dl>
  )
}

function CartLineRow({ line }: { line: CartLine }) {
  const updateQuantity = useCartStore((s) => s.updateQuantity)
  const remove = useCartStore((s) => s.remove)
  const max = Math.max(1, line.stock_quantity)

  return (
    <li className={cn('flex gap-3 px-5 py-4', !line.available && 'bg-danger-50/40')}>
      <Link to={`/products/${line.product.slug}`} className="size-20 shrink-0 overflow-hidden rounded-xl border border-line bg-canvas">
        {line.product.thumbnail_url
          ? <img src={line.product.thumbnail_url} alt="" className="size-full object-cover" />
          : <span className="grid size-full place-items-center text-ink-subtle"><ShoppingBag className="size-5" /></span>}
      </Link>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <Link to={`/products/${line.product.slug}`} className="line-clamp-2 text-sm font-medium hover:text-brand-700">{line.product.name}</Link>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-subtle">
              {line.variant && <span>{Object.values(line.variant.attributes).join(' / ')}</span>}
              {line.variant && <span>SKU {line.variant.sku}</span>}
              {line.is_negotiated && <Badge tone="success">Agreed price</Badge>}
            </p>
          </div>
          <button type="button" onClick={() => void remove(line.id)} className="rounded-lg p-1.5 text-ink-subtle hover:bg-danger-50 hover:text-danger-600" aria-label={`Remove ${line.product.name}`}>
            <Trash2 className="size-4" />
          </button>
        </div>

        {line.issues.length > 0 && (
          <ul className="mt-2 list-inside list-disc text-xs text-danger-600">
            {line.issues.map((issue) => <li key={issue}>{issue}</li>)}
          </ul>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          {line.is_negotiated ? (
            <span className="text-xs text-ink-muted">Quantity {line.quantity} (agreed with the seller)</span>
          ) : (
            <div className="inline-flex items-center rounded-xl border border-line bg-surface">
              <button type="button" className="grid size-8 place-items-center rounded-l-xl text-ink-muted hover:bg-canvas disabled:opacity-40" disabled={line.quantity <= 1} onClick={() => void updateQuantity(line.id, line.quantity - 1)} aria-label="Decrease quantity">
                <Minus className="size-3.5" />
              </button>
              <span className="w-9 text-center text-sm font-medium" aria-live="polite">{line.quantity}</span>
              <button type="button" className="grid size-8 place-items-center rounded-r-xl text-ink-muted hover:bg-canvas disabled:opacity-40" disabled={line.quantity >= max} onClick={() => void updateQuantity(line.id, line.quantity + 1)} aria-label="Increase quantity">
                <Plus className="size-3.5" />
              </button>
            </div>
          )}

          <div className="text-right">
            <p className="text-sm font-semibold">{formatPrice(line.line_total)}</p>
            <p className="text-xs text-ink-subtle">
              {line.is_negotiated && line.original_price > line.unit_price && <span className="mr-1 line-through">{formatPrice(line.original_price)}</span>}
              {formatPrice(line.unit_price)} each
            </p>
          </div>
        </div>
      </div>
    </li>
  )
}

function CartSkeleton() {
  return (
    <div className="mx-auto max-w-[90rem] space-y-5 px-4 py-10 sm:px-6 lg:px-8">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-40 rounded-2xl" />
      <Skeleton className="h-40 rounded-2xl" />
    </div>
  )
}
