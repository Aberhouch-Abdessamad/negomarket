import { PackageSearch, Search } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Alert, Button, EmptyState, Input, Pagination, Skeleton, Table, TableWrap, Tabs, Td, Th } from '@/components/ui'
import { useAsync } from '@/hooks/useAsync'
import { formatDate, formatPrice } from '@/utils/format'
import { OrderStatusBadge, PaymentStatusBadge } from '@/features/orders/components/OrderStatusBadge'
import type { OrderStatus } from '@/features/orders/types'
import { adminService } from '../adminService'

type StatusTab = 'all' | OrderStatus

const tabs: { value: StatusTab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'processing', label: 'Processing' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'returned', label: 'Returned' },
]

/** Platform-wide order oversight with search across reference, customer and store. */
export default function AdminOrdersPage() {
  const [searchParams] = useSearchParams()
  const requested = searchParams.get('status') as StatusTab | null
  const [tab, setTab] = useState<StatusTab>(tabs.some((item) => item.value === requested) && requested ? requested : 'all')
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)

  const { data, error, loading } = useAsync(
    () => adminService.orders({ status: tab === 'all' ? undefined : tab, q: query || undefined, page }),
    [tab, query, page],
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Orders</h1>
        <p className="mt-1 text-sm text-ink-muted">Every order across the marketplace, with administrative overrides.</p>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="overflow-x-auto">
          <Tabs label="Filter orders by status" value={tab} onChange={(value) => { setTab(value); setPage(1) }} items={tabs} />
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => { e.preventDefault(); setQuery(search.trim()); setPage(1) }}
        >
          <Input
            aria-label="Search orders"
            placeholder="Reference, customer, email or store"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 sm:w-72"
            trailing={<Search className="size-4 text-ink-subtle" aria-hidden />}
          />
          <Button type="submit" variant="secondary">Search</Button>
        </form>
      </div>

      {error && <Alert tone="danger">{error.message}</Alert>}

      {loading && !data ? (
        <Skeleton className="h-72 rounded-2xl" />
      ) : data?.data.length === 0 ? (
        <EmptyState
          icon={PackageSearch}
          title={query ? 'No orders match your search' : 'No orders here yet'}
          message={query ? 'Try a different reference, customer, email or store name.' : 'Orders placed across every store will appear here.'}
        />
      ) : (
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>Order</Th>
                <Th>Customer</Th>
                <Th>Store</Th>
                <Th>Placed</Th>
                <Th>Status</Th>
                <Th>Payment</Th>
                <Th className="text-right">Total</Th>
                <Th><span className="sr-only">Actions</span></Th>
              </tr>
            </thead>
            <tbody>
              {data?.data.map((order) => (
                <tr key={order.id} className="hover:bg-canvas/40">
                  <Td>
                    <Link to={`/admin/orders/${order.id}`} className="font-medium hover:text-brand-700">{order.reference_number}</Link>
                    <p className="mt-0.5 text-xs text-ink-subtle">{order.items.length} {order.items.length === 1 ? 'item' : 'items'}</p>
                  </Td>
                  <Td>
                    <p className="font-medium">{order.customer?.name ?? 'Customer'}</p>
                    <p className="text-xs text-ink-subtle">{order.customer?.email}</p>
                  </Td>
                  <Td>
                    {order.store ? (
                      <Link to={`/stores/${order.store.slug}`} className="hover:text-brand-700">{order.store.name}</Link>
                    ) : '—'}
                  </Td>
                  <Td className="whitespace-nowrap text-ink-muted">{order.created_at ? formatDate(order.created_at) : '—'}</Td>
                  <Td><OrderStatusBadge status={order.status} label={order.status_label} /></Td>
                  <Td>{order.payment ? <PaymentStatusBadge status={order.payment.status} label={order.payment.status_label} /> : '—'}</Td>
                  <Td className="whitespace-nowrap text-right font-semibold">{formatPrice(order.total_amount)}</Td>
                  <Td className="text-right">
                    <Link to={`/admin/orders/${order.id}`}><Button size="sm" variant="secondary">Open</Button></Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      )}

      {data && <Pagination page={data.meta.current_page} lastPage={data.meta.last_page} onChange={setPage} />}
    </div>
  )
}
