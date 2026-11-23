import { CheckCircle2, Package, Truck } from 'lucide-react'
import { Link, useLocation } from 'react-router'
import { Button, Card, CardBody, EmptyState } from '@/components/ui'
import type { OrderGroup } from '@/features/cart/types'
import { formatPrice } from '@/utils/format'

/** Post-checkout summary. State is carried from the placement request. */
export default function OrderConfirmationPage() {
  const state = useLocation().state as { group?: OrderGroup } | null
  const group = state?.group

  if (!group) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <EmptyState
          icon={Package}
          title="No recent order to show"
          message="If you just placed an order, you can find it in your order history."
          action={<Link to="/products"><Button>Continue shopping</Button></Link>}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col items-center text-center">
        <span className="grid size-14 place-items-center rounded-2xl bg-success-50 text-success-600 ring-1 ring-inset ring-emerald-200">
          <CheckCircle2 className="size-7" aria-hidden />
        </span>
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight sm:text-3xl">Order placed</h1>
        <p className="mt-1 max-w-xl text-sm text-ink-muted">
          Reference <strong className="text-ink">{group.reference_number}</strong>. Pay cash to the courier when each store's parcel arrives.
        </p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <SummaryTile label="Total" value={formatPrice(group.total_amount)} />
        <SummaryTile label="Stores" value={String(group.order_count ?? group.orders.length)} />
        <SummaryTile label="Payment" value={group.payment_method_label} />
      </div>

      <div className="mt-6 space-y-4">
        {group.orders.map((order) => (
          <Card key={order.id}>
            <CardBody className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">{order.store.name}</p>
                  <p className="text-xs text-ink-subtle">Order {order.reference_number} · {order.status_label}</p>
                </div>
                <span className="text-sm font-semibold">{formatPrice(order.total_amount)}</span>
              </div>
              <ul className="space-y-2 border-t border-line pt-3">
                {order.items.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 text-sm">
                    <span className="size-10 shrink-0 overflow-hidden rounded-lg bg-canvas">
                      {item.thumbnail_url ? <img src={item.thumbnail_url} alt="" className="size-full object-cover" /> : <span className="grid size-full place-items-center text-ink-subtle"><Package className="size-4" /></span>}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{item.product_name}</span>
                      <span className="text-xs text-ink-subtle">
                        {item.variant_attributes ? `${Object.values(item.variant_attributes).join(' / ')} · ` : ''}Qty {item.quantity}
                        {item.is_negotiated ? ' · agreed price' : ''}
                      </span>
                    </span>
                    <span className="font-medium">{formatPrice(item.total_price)}</span>
                  </li>
                ))}
              </ul>
              {order.address && (
                <p className="rounded-xl bg-canvas p-3 text-xs text-ink-muted">
                  <span className="font-semibold text-ink">Delivering to </span>
                  {order.address.full_name}, {order.address.address_line1}
                  {order.address.address_line2 ? `, ${order.address.address_line2}` : ''}, {order.address.city} · {order.address.phone}
                </p>
              )}
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link to="/products"><Button variant="secondary">Continue shopping</Button></Link>
        <Link to="/orders"><Button leftIcon={<Truck className="size-4" />}>View my orders</Button></Link>
      </div>
    </div>
  )
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 text-center">
      <p className="text-xs uppercase tracking-wide text-ink-subtle">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  )
}
