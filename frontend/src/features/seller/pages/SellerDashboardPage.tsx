import { AlertTriangle, Banknote, Eye, Handshake, Package, PackagePlus, ShoppingCart, Star, Wallet } from 'lucide-react'
import { Link } from 'react-router'
import { Alert, Badge, Card, CardBody, Skeleton, StatCard } from '@/components/ui'
import { useAsync } from '@/hooks/useAsync'
import { useAuthStore } from '@/store/authStore'
import { formatDate, formatPrice } from '@/utils/format'
import { ProductStatusBadge } from '../components/ProductStatusBadge'
import { SalesChart } from '../components/SalesChart'
import { sellerService } from '../sellerService'

export default function SellerDashboardPage() {
  const user = useAuthStore((s) => s.user)
  const { data, loading, error } = useAsync(() => sellerService.dashboard(), [])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Welcome back, {user?.name.split(' ')[0]}</h1>
          <p className="mt-1 text-sm text-ink-muted">Here is how {user?.store?.name} is doing over the last 30 days.</p>
        </div>
        <Link to="/seller/products/new" className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-brand-700">
          <PackagePlus className="size-4" aria-hidden /> Add product
        </Link>
      </div>

      {error && <Alert tone="danger">{error.message}</Alert>}

      {loading && !data ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-32" />)}</div>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <StatCard icon={Banknote} label="Revenue (30 days)" value={formatPrice(data.kpis.revenue_30d)} hint="Excludes cancelled and returned orders" />
            <StatCard icon={ShoppingCart} label="Orders (30 days)" value={data.kpis.orders_30d} hint={`${data.kpis.pending_orders} awaiting confirmation`} />
            <StatCard icon={Wallet} label="COD to collect" value={formatPrice(data.kpis.cod_to_collect)} tone="warning" hint={`${formatPrice(data.kpis.cod_collected_30d)} collected in 30 days`} />
            <StatCard icon={Handshake} label="Active negotiations" value={data.kpis.active_negotiations} tone="accent" hint={`${data.kpis.offers_awaiting_reply} offers awaiting your reply`} />
            <StatCard icon={Package} label="Published products" value={data.products.by_status.published} hint={`${data.products.by_status.pending_review} in review · ${data.products.by_status.draft} drafts`} />
            <StatCard icon={AlertTriangle} label="Stock alerts" value={data.products.low_stock + data.products.out_of_stock} tone="danger" hint={`${data.products.low_stock} low · ${data.products.out_of_stock} out of stock`} />
            <StatCard icon={Eye} label="Product views" value={data.kpis.product_views.toLocaleString()} />
            <StatCard icon={Star} label="Store rating" value={data.kpis.rating_count ? data.kpis.rating_avg.toFixed(1) : '–'} hint={`${data.kpis.rating_count} reviews`} />
          </div>

          <Card>
            <CardBody>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-semibold">Revenue – last 30 days</h2>
                <Link to="/seller/analytics" className="text-sm font-medium text-brand-600 hover:text-brand-700">Analytics →</Link>
              </div>
              <SalesChart data={data.sales_last_30_days} />
            </CardBody>
          </Card>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardBody>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-semibold">Stock alerts</h2>
                  <Link to="/seller/inventory?stock=low" className="text-sm font-medium text-brand-600 hover:text-brand-700">Inventory →</Link>
                </div>
                {data.low_stock_products.length === 0 ? (
                  <p className="py-6 text-center text-sm text-ink-muted">All products are well stocked.</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {data.low_stock_products.map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                        <div className="min-w-0">
                          <Link to={`/seller/products/${p.id}`} className="block truncate text-sm font-medium hover:text-brand-700">{p.name}</Link>
                          <p className="text-xs text-ink-subtle">{p.sku}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <ProductStatusBadge status={p.status} />
                          <Badge tone={p.stock_quantity === 0 ? 'danger' : 'warning'}>{p.stock_quantity === 0 ? 'Out of stock' : `${p.stock_quantity} left`}</Badge>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <h2 className="mb-3 font-semibold">Recent orders</h2>
                {data.recent_orders.length === 0 ? (
                  <p className="py-6 text-center text-sm text-ink-muted">No orders yet. They will appear here after checkout is launched.</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {data.recent_orders.map((o) => (
                      <li key={o.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                        <div>
                          <p className="font-medium">{o.reference_number}</p>
                          <p className="text-xs text-ink-subtle">{o.customer} · {formatDate(o.created_at)}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{formatPrice(o.total_amount)}</p>
                          <p className="text-xs capitalize text-ink-subtle">{o.status}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  )
}
