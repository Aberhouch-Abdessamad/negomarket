import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatPrice } from '@/utils/format'
import type { DailyPoint } from '../types'

const short = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

export function SalesChart({ data, height = 260 }: { data: DailyPoint[]; height?: number }) {
  const empty = data.every((d) => d.revenue === 0)

  return (
    <div className="relative" style={{ height }}>
      {empty && (
        <p className="absolute inset-0 z-10 grid place-items-center text-sm text-ink-subtle">No sales in this period yet. Orders appear here once customers check out.</p>
      )}
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-brand-500)" stopOpacity={0.25} />
              <stop offset="100%" stopColor="var(--color-brand-500)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--color-line)" />
          <XAxis dataKey="date" tickFormatter={short} tick={{ fontSize: 11, fill: 'var(--color-ink-subtle)' }} axisLine={false} tickLine={false} minTickGap={24} />
          <YAxis width={56} tick={{ fontSize: 11, fill: 'var(--color-ink-subtle)' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
          <Tooltip
            formatter={(v, name) => (name === 'revenue' ? [formatPrice(Number(v)), 'Revenue'] : [v, 'Orders'])}
            labelFormatter={(l) => short(String(l))}
            contentStyle={{ borderRadius: 12, border: '1px solid var(--color-line)', fontSize: 12 }}
          />
          <Area isAnimationActive={false} type="monotone" dataKey="revenue" stroke="var(--color-brand-600)" strokeWidth={2} fill="url(#rev)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
