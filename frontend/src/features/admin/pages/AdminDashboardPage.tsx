import { ClipboardCheck, Handshake, PackageCheck, ShieldAlert, ShoppingBag, Star, Store, Users, Wallet } from 'lucide-react'
import { Link } from 'react-router'
import { Alert, Card, CardBody, CardHeader, EmptyState, Skeleton, StatCard, Table, TableWrap, Td, Th } from '@/components/ui'
import { useAsync } from '@/hooks/useAsync'
import { formatDate, formatPrice } from '@/utils/format'
import { adminService } from '../adminService'
import { SalesChart } from '../components/SalesChart'
import { OrderStatusBadge } from '@/features/orders/components/OrderStatusBadge'

export default function AdminDashboardPage() {
  const { data, error, loading } = useAsync(() => adminService.dashboard(), [])

  if (loading && !data) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-9 w-56" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    )
  }

  if (error || !data) {
    return <Alert tone="danger" title="Dashboard unavailable">{error?.message ?? 'The platform metrics could not be loaded.'}</Alert>
  }

  const attention = [
    { label: 'Seller applications awaiting review', count: data.applications.pending, to: '/admin/seller-applications', icon: ClipboardCheck },
    { label: 'Products awaiting moderation', count: data.products.pending_review, to: '/admin/moderation', icon: PackageCheck },
    { label: 'Reviews awaiting moderation', count: data.reviews.pending, to: '/admin/reviews', icon: Star },
    { label: 'Open disputes', count: data.disputes.open, to: '/admin/disputes', icon: ShieldAlert },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Platform overview</h1>
        <p className="mt-1 text-sm text-ink-muted">Marketplace health, sales and the queues that need attention.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Wallet} label="Revenue (all time)" value={formatPrice(data.orders.revenue_total)} hint={`${formatPrice(data.orders.revenue_30d)} in the last 30 days`} tone="success" />
        <StatCard icon={ShoppingBag} label="Orders" value={data.orders.total.toLocaleString()} hint={`${data.orders.pending} pending · ${data.orders.last_30d} in the last 30 days`} />
        <StatCard icon={Users} label="Accounts" value={data.users.total.toLocaleString()} hint={`${data.users.sellers} sellers · ${data.users.new_30d} new in 30 days`} />
        <StatCard icon={Store} label="Stores" value={`${data.stores.active} / ${data.stores.total}`} hint="Active / total" />
        <StatCard icon={Handshake} label="Active negotiations" value={data.negotiations.active.toLocaleString()} hint={`${data.payments.collected_total > 0 ? formatPrice(data.payments.collected_total) : 'No cash'} collected`} />
        <StatCard icon={ShieldAlert} label="Open disputes" value={data.disputes.open.toLocaleString()} hint={`${data.disputes.resolved_30d} closed in the last 30 days`} tone={data.disputes.open > 0 ? 'warning' : 'brand'} />
        <StatCard icon={Star} label="Reviews" value={data.reviews.pending.toLocaleString()} hint={`${data.reviews.approved} approved total`} tone={data.reviews.pending > 0 ? 'warning' : 'brand'} />
        <StatCard icon={PackageCheck} label="Products" value={data.products.total.toLocaleString()} hint={`${data.products.pending_review} awaiting moderation`} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <div>
              <h2 className="font-semibold">Sales, last 14 days</h2>
              <p className="text-xs text-ink-muted">Orders that count towards revenue.</p>
            </div>
          </CardHeader>
          <CardBody>
            <SalesChart points={data.sales_series} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="font-semibold">Needs attention</h2>
          </CardHeader>
          <CardBody className="space-y-2 pt-4">
            {attention.map(({ label, count, to, icon: Icon }) => (
              <Link key={to} to={to} className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2.5 text-sm transition-colors hover:border-brand-200 hover:bg-brand-50/40">
                <span className="inline-flex items-center gap-2">
                  <Icon className="size-4 text-brand-600" aria-hidden />
                  {label}
                </span>
                <span className="rounded-full bg-canvas px-2.5 py-0.5 text-xs font-semibold text-ink-muted">{count}</span>
              </Link>
            ))}
            <p className="pt-1 text-xs text-ink-subtle">Uncollected COD: {formatPrice(data.payments.uncollected_total)}</p>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <h2 className="font-semibold">Recent orders</h2>
          <Link to="/admin/orders" className="text-sm font-medium text-brand-600 hover:text-brand-700">All orders</Link>
        </CardHeader>
        <CardBody className="pt-4">
          {data.recent_orders.length === 0 ? (
            <EmptyState icon={ShoppingBag} title="No orders yet" message="Orders placed across every store will appear here." />
          ) : (
            <TableWrap className="border-0 shadow-none">
              <Table>
                <thead>
                  <tr>
                    <Th>Order</Th>
                    <Th>Customer</Th>
                    <Th>Store</Th>
                    <Th>Status</Th>
                    <Th className="text-right">Total</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent_orders.map((order) => (
                    <tr key={order.id} className="hover:bg-canvas/50">
                      <Td>
                        <Link to={`/admin/orders/${order.id}`} className="font-medium text-brand-700 hover:underline">{order.reference_number}</Link>
                        <span className="block text-xs text-ink-subtle">{order.created_at ? formatDate(order.created_at) : ''}</span>
                      </Td>
                      <Td>{order.customer?.name ?? '—'}</Td>
                      <Td>{order.store?.name ?? '—'}</Td>
                      <Td><OrderStatusBadge status={order.status} label={order.status_label} /></Td>
                      <Td className="text-right font-semibold">{formatPrice(order.total_amount)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </CardBody>
      </Card>
    </div>
  )
}
