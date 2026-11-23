import { Star } from 'lucide-react'
import { cn } from '@/utils/cn'

export function RatingStars({ value, count, size = 'sm', className }: { value: number; count?: number; size?: 'sm' | 'md'; className?: string }) {
  const icon = size === 'sm' ? 'size-3.5' : 'size-4.5'
  return (
    <span className={cn('inline-flex items-center gap-1', className)} aria-label={count === 0 ? 'No ratings yet' : `Rated ${value.toFixed(1)} out of 5${count !== undefined ? ` from ${count} reviews` : ''}`}>
      <span className="flex" aria-hidden>
        {[1, 2, 3, 4, 5].map((i) => (
          <Star key={i} className={cn(icon, i <= Math.round(value) ? 'fill-accent-500 text-accent-500' : 'fill-line text-line')} />
        ))}
      </span>
      {count !== undefined && <span className="whitespace-nowrap text-xs text-ink-subtle">{count > 0 ? `${value.toFixed(1)} (${count})` : 'No reviews'}</span>}
    </span>
  )
}
