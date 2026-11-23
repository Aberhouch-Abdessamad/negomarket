import { Banknote, ReceiptText, ShoppingBag, TrendingUp, Wallet } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { Alert, Card, CardBody, CardHeader, EmptyState, Select, Skeleton, StatCard, Table, TableWrap, Td, Th } from '@/components/ui'
import { useAsync } from '@/hooks/useAsync'
import { formatDate, formatPrice } from '@/utils/format'
import { adminService } from '../adminService'
import { SalesChart } from '../components/SalesChart'
import { OrderStatusBadge } from '@/features/orders/components/OrderStatusBadge'

const ranges = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '365', label: 'Last 12 months' },
]

export default function AdminReportsPage() {
  const [days, setDays] = useState('30')
  const { data, error, loading } = useAsync(() => adminService.salesReport(Number(days)), [days])

  if (error) {
    return <Alert tone="danger" title="Report unavailable">{error.message}</Alert>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Sales report</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Revenue excludes cancelled and returned orders.
            {data && <span className="ml-1">{formatDate(data.range.from)} – {formatDate(data.range.to)}</span>}
          </p>
        </div>
        <Select aria-label="Reporting period" value={days} onChange={(e) => setDays(e.target.value)} options={ranges} className="w-48" />
      </div>

      {loading && !data ? (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
          </div>
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      ) : data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={Wallet} label="Revenue" value={formatPrice(data.totals.revenue)} hint={`${data.totals.orders} orders in the period`} tone="success" />
            <StatCard icon={TrendingUp} label="Average order value" value={formatPrice(data.totals.average_order_value)} hint="Revenue ÷ orders" />
            <StatCard icon={Banknote} label="Cash collected" value={formatPrice(data.totals.collected)} hint={`${formatPrice(data.totals.uncollected)} still uncollected`} />
            <StatCard icon={ShoppingBag} label="Orders" value={data.totals.orders.toLocaleString()} hint="Cancelled and returned excluded" />
          </div>

          <Card>
            <CardHeader>
              <h2 className="font-semibold">Daily revenue</h2>
              <span className="text-xs text-ink-subtle">{data.sales_series.length} days</span>
            </CardHeader>
            <CardBody>
              <SalesChart points={data.sales_series} />
            </CardBody>
          </Card>

          <div className="grid gap-5 xl:grid-cols-2">
            <Card>
              <CardHeader><h2 className="font-semibold">Top stores</h2></CardHeader>
              <CardBody className="pt-4">
                {data.top_stores.length === 0 ? (
                  <EmptyState icon={ReceiptText} title="No store sales" message="No revenue was recorded in this period." />
                ) : (
                  <TableWrap className="border-0 shadow-none">
                    <Table>
                      <thead>
                        <tr>
                          <Th>Store</Th>
                          <Th className="text-right">Orders</Th>
                          <Th className="text-right">Revenue</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.top_stores.map((store) => (
                          <tr key={store.id}>
                            <Td className="font-medium">{store.name}</Td>
                            <Td className="text-right text-ink-muted">{store.orders_count}</Td>
                            <Td className="text-right font-semibold">{formatPrice(store.revenue)}</Td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </TableWrap>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader><h2 className="font-semibold">Top products</h2></CardHeader>
              <CardBody className="pt-4">
                {data.top_products.length === 0 ? (
                  <EmptyState icon={ReceiptText} title="No product sales" message="No revenue was recorded in this period." />
                ) : (
                  <TableWrap className="border-0 shadow-none">
                    <Table>
                      <thead>
                        <tr>
                          <Th>Product</Th>
                          <Th className="text-right">Units</Th>
                          <Th className="text-right">Revenue</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.top_products.map((product) => (
                          <tr key={product.id}>
                            <Td className="font-medium">{product.name}</Td>
                            <Td className="text-right text-ink-muted">{product.quantity}</Td>
                            <Td className="text-right font-semibold">{formatPrice(product.revenue)}</Td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </TableWrap>
                )}
              </CardBody>
            </Card>
          </div>

          <Card>
            <CardHeader><h2 className="font-semibold">Orders by status</h2></CardHeader>
            <CardBody className="flex flex-wrap gap-2 pt-4">
              {Object.keys(data.status_breakdown).length === 0 ? (
                <p className="text-sm text-ink-muted">No orders in this period.</p>
              ) : (
                Object.entries(data.status_breakdown).map(([status, count]) => (
                  <Link
                    key={status}
                    to={`/admin/orders?status=${status}`}
                    className="flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm transition-colors hover:border-brand-200"
                  >
                    <OrderStatusBadge status={status} />
                    <span className="font-semibold">{count}</span>
                  </Link>
                ))
              )}
            </CardBody>
          </Card>
        </>
      ) : null}
    </div>
  )
}
