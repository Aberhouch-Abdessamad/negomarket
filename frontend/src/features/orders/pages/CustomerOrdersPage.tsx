import { Package, ShoppingBag } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { Button, Card, CardBody, EmptyState, Pagination, Skeleton, Tabs } from '@/components/ui'
import { useAsync } from '@/hooks/useAsync'
import { formatDate, formatPrice } from '@/utils/format'
import { orderService } from '../orderService'
import type { OrderStatus } from '../types'
import { OrderStatusBadge } from '../components/OrderStatusBadge'
import { OrderItems } from '../components/OrderItems'

type StatusTab = 'all' | OrderStatus

const statusTabs: { value: StatusTab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'processing', label: 'Processing' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'returned', label: 'Returned' },
]

/** Customer order history. Each row is one store's part of a checkout. */
export default function CustomerOrdersPage() {
  const [tab, setTab] = useState<StatusTab>('all')
  const [page, setPage] = useState(1)
  const { data, error, loading } = useAsync(
    () => orderService.customerOrders({ status: tab === 'all' ? undefined : tab, page }),
    [tab, page],
  )

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">My orders</h1>
          <p className="mt-1 text-sm text-ink-muted">Track each store's parcel, confirm receipt and review what you bought.</p>
        </div>
        <Link to="/products">
          <Button variant="secondary" leftIcon={<ShoppingBag className="size-4" />}>Continue shopping</Button>
        </Link>
      </div>

      <div className="mt-6 overflow-x-auto">
        <Tabs
          label="Filter orders by status"
          value={tab}
          onChange={(value) => {
            setTab(value)
            setPage(1)
          }}
          items={statusTabs}
        />
      </div>

      <div className="mt-6 space-y-4">
        {loading && !data && [1, 2, 3].map((i) => <Skeleton key={i} className="h-44 rounded-2xl" />)}

        {error && (
          <p role="alert" className="rounded-xl bg-danger-50 p-4 text-sm text-danger-600">{error.message}</p>
        )}

        {!loading && data?.data.length === 0 && (
          <EmptyState
            icon={Package}
            title={tab === 'all' ? 'No orders yet' : 'No orders with this status'}
            message={tab === 'all' ? 'When you check out, each store sends its own parcel and it will appear here.' : 'Try another status tab to see your other orders.'}
            action={<Link to="/products"><Button>Browse the marketplace</Button></Link>}
          />
        )}

        {data?.data.map((order) => (
          <Card key={order.id}>
            <CardBody className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{order.store?.name}</p>
                  <p className="mt-0.5 text-xs text-ink-subtle">
                    {order.reference_number} · {order.created_at ? formatDate(order.created_at) : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <OrderStatusBadge status={order.status} label={order.status_label} />
                  <span className="text-sm font-semibold">{formatPrice(order.total_amount)}</span>
                </div>
              </div>

              <div className="border-t border-line pt-3">
                <OrderItems items={order.items} />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                <p className="text-xs text-ink-subtle">
                  {order.payment ? `${order.payment.method_label} · ${order.payment.status_label}` : ''}
                  {order.received_at ? ' · receipt confirmed' : ''}
                </p>
                <Link to={`/orders/${order.id}`}>
                  <Button variant="secondary" size="sm">View order</Button>
                </Link>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      {data && <div className="mt-6"><Pagination page={data.meta.current_page} lastPage={data.meta.last_page} onChange={setPage} /></div>}
    </div>
  )
}
