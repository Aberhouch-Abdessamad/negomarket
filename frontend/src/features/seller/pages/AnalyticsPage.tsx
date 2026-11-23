import { Banknote, Handshake, Percent, ShoppingCart } from 'lucide-react'
import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Alert, Card, CardBody, Skeleton, StatCard, Table, TableWrap, Tabs, Td, Th } from '@/components/ui'
import { useAsync } from '@/hooks/useAsync'
import { formatPrice } from '@/utils/format'
import { SalesChart } from '../components/SalesChart'
import { sellerService } from '../sellerService'

type Period = '7' | '30' | '90'

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>('30')
  const { data, loading, error } = useAsync(() => sellerService.analytics(Number(period) as 7 | 30 | 90), [period])
  const negotiationBars = data ? Object.entries(data.negotiations.by_status).map(([status, total]) => ({ status: status.replace(/_/g, ' '), total })) : []

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Analytics</h1>
          <p className="mt-1 text-sm text-ink-muted">Sales and negotiation performance for your store.</p>
        </div>
        <Tabs label="Period" value={period} onChange={setPeriod} items={[{ value: '7', label: '7 days' }, { value: '30', label: '30 days' }, { value: '90', label: '90 days' }]} />
      </div>
      {error && <Alert tone="danger">{error.message}</Alert>}
      {loading && !data ? (
        <Skeleton className="h-96" />
      ) : data ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <StatCard icon={Banknote} label="Revenue" value={formatPrice(data.totals.revenue)} />
            <StatCard icon={ShoppingCart} label="Orders" value={data.totals.orders} hint={`Average ${formatPrice(data.totals.average_order_value)}`} />
            <StatCard icon={Handshake} label="Negotiation conversion" value={`${data.negotiations.conversion_rate}%`} tone="success" hint={`${data.negotiations.accepted} of ${data.negotiations.total} negotiations`} />
            <StatCard icon={Percent} label="Avg. negotiated discount" value={`${data.negotiations.average_discount_percent}%`} tone="warning" hint="Agreed price vs listed price" />
          </div>
          <Card>
            <CardBody>
              <h2 className="mb-4 font-semibold">Revenue</h2>
              <SalesChart data={data.series} height={280} />
            </CardBody>
          </Card>
          <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
            <div>
              <h2 className="mb-3 font-semibold">Top products</h2>
              <TableWrap>
                <Table>
                  <thead>
                    <tr><Th>Product</Th><Th className="text-right">Units</Th><Th className="text-right">Revenue</Th><Th className="text-right">Negotiated</Th></tr>
                  </thead>
                  <tbody>
                    {data.top_products.length === 0 ? (
                      <tr><Td colSpan={4} className="py-10 text-center text-ink-muted">No sales in this period.</Td></tr>
                    ) : (
                      data.top_products.map((p) => (
                        <tr key={p.product_id}>
                          <Td className="font-medium">{p.name}</Td>
                          <Td className="text-right">{p.units}</Td>
                          <Td className="text-right">{formatPrice(p.revenue)}</Td>
                          <Td className="text-right">{p.negotiated_lines}</Td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </Table>
              </TableWrap>
            </div>
            <Card>
              <CardBody>
                <h2 className="mb-4 font-semibold">Negotiations by outcome</h2>
                <div style={{ height: 240 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={negotiationBars} layout="vertical" margin={{ left: 24 }}>
                      <CartesianGrid horizontal={false} stroke="var(--color-line)" />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="status" width={110} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                      <Bar dataKey="total" fill="var(--color-accent-500)" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardBody>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  )
}
