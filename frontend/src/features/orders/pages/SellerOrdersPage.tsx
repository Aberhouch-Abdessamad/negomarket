import { PackageSearch, Search } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { Button, EmptyState, Input, Pagination, Skeleton, Table, TableWrap, Tabs, Td, Th } from '@/components/ui'
import { useAsync } from '@/hooks/useAsync'
import { formatDate, formatPrice } from '@/utils/format'
import { orderService } from '../orderService'
import type { OrderStatus } from '../types'
import { OrderStatusBadge, PaymentStatusBadge } from '../components/OrderStatusBadge'

type StatusTab = 'all' | OrderStatus

const statusTabs: { value: StatusTab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'New' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'processing', label: 'Processing' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'returned', label: 'Returned' },
]

/** Fulfilment queue for the signed-in seller's store. */
export default function SellerOrdersPage() {
  const [tab, setTab] = useState<StatusTab>('all')
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const { data, error, loading } = useAsync(
    () => orderService.sellerOrders({ status: tab === 'all' ? undefined : tab, q: query || undefined, page }),
    [tab, query, page],
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Orders</h1>
        <p className="mt-1 text-sm text-ink-muted">Confirm, pack and ship orders, then record the cash you collected.</p>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="overflow-x-auto">
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
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            setQuery(search.trim())
            setPage(1)
          }}
        >
          <Input
            aria-label="Search orders"
            placeholder="Reference, customer or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 lg:w-72"
            trailing={<Search className="size-4 text-ink-subtle" aria-hidden />}
          />
          <Button type="submit" variant="secondary">Search</Button>
        </form>
      </div>

      {loading && !data && <Skeleton className="h-72 rounded-2xl" />}

      {error && <p role="alert" className="rounded-xl bg-danger-50 p-4 text-sm text-danger-600">{error.message}</p>}

      {!loading && data?.data.length === 0 && (
        <EmptyState
          icon={PackageSearch}
          title={query ? 'No orders match your search' : 'No orders here yet'}
          message={query ? 'Try a different reference number, customer name or email.' : 'New orders from your storefront will appear here as soon as a customer checks out.'}
          action={<Link to="/seller/products"><Button variant="secondary">Manage products</Button></Link>}
        />
      )}

      {data && data.data.length > 0 && (
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>Order</Th>
                <Th>Customer</Th>
                <Th>Placed</Th>
                <Th>Status</Th>
                <Th>Payment</Th>
                <Th className="text-right">Total</Th>
                <Th><span className="sr-only">Actions</span></Th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((order) => (
                <tr key={order.id} className="hover:bg-canvas/40">
                  <Td>
                    <Link to={`/seller/orders/${order.id}`} className="font-medium hover:text-brand-700">{order.reference_number}</Link>
                    <p className="mt-0.5 text-xs text-ink-subtle">{order.items.length} {order.items.length === 1 ? 'item' : 'items'}</p>
                  </Td>
                  <Td>
                    <p className="font-medium">{order.customer?.name ?? 'Customer'}</p>
                    <p className="text-xs text-ink-subtle">{order.customer?.email}</p>
                  </Td>
                  <Td className="text-ink-muted">{order.created_at ? formatDate(order.created_at) : '-'}</Td>
                  <Td><OrderStatusBadge status={order.status} label={order.status_label} /></Td>
                  <Td>{order.payment ? <PaymentStatusBadge status={order.payment.status} label={order.payment.status_label} /> : '-'}</Td>
                  <Td className="text-right font-semibold">{formatPrice(order.total_amount)}</Td>
                  <Td className="text-right">
                    <Link to={`/seller/orders/${order.id}`}><Button size="sm" variant="secondary">Open</Button></Link>
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
