import { cn } from '@/utils/cn'
import type { DailyPoint } from '../types'

/**
 * Dependency-free bar chart for daily revenue or order volume. Values come
 * straight from the API; the chart only scales them for display.
 */
export function SalesChart({ points, metric = 'revenue', className }: { points: DailyPoint[]; metric?: 'revenue' | 'orders'; className?: string }) {
  const values = points.map((p) => (metric === 'revenue' ? p.revenue : p.orders))
  const max = Math.max(...values, 1)
  const total = values.reduce((sum, value) => sum + value, 0)

  if (points.length === 0) {
    return <p className="py-10 text-center text-sm text-ink-subtle">No data for this period.</p>
  }

  return (
    <div className={className}>
      <div className="flex h-40 items-end gap-1" role="img" aria-label={`Daily ${metric} for the last ${points.length} days`}>
        {points.map((point) => {
          const value = metric === 'revenue' ? point.revenue : point.orders
          const height = value > 0 ? Math.max(4, Math.round((value / max) * 100)) : 2
          return (
            <div key={point.date} className="group relative flex h-full flex-1 items-end">
              <div
                className={cn(
                  'w-full rounded-t-md transition-colors',
                  value > 0 ? 'bg-brand-500 group-hover:bg-brand-600' : 'bg-line',
                )}
                style={{ height: `${height}%` }}
                title={`${point.date}: ${metric === 'revenue' ? `${value.toFixed(2)} MAD` : `${value} orders`}`}
              />
            </div>
          )
        })}
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-ink-subtle">
        <span>{new Date(points[0].date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
        <span>{metric === 'revenue' ? `${total.toLocaleString('en-US')} MAD total` : `${total.toLocaleString('en-US')} orders total`}</span>
        <span>{new Date(points[points.length - 1].date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
      </div>
    </div>
  )
}
