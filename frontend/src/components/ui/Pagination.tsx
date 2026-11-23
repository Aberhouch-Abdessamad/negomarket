import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/utils/cn'

/** Server-side pagination control. Shows first, last and a window around the current page. */
export function Pagination({ page, lastPage, onChange }: { page: number; lastPage: number; onChange: (page: number) => void }) {
  if (lastPage <= 1) return null

  const pages: (number | '…')[] = []
  for (let p = 1; p <= lastPage; p++) {
    if (p === 1 || p === lastPage || Math.abs(p - page) <= 1) pages.push(p)
    else if (pages[pages.length - 1] !== '…') pages.push('…')
  }

  const btn = 'grid h-10 min-w-10 place-items-center rounded-xl px-3 text-sm font-medium transition-colors'
  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-1">
      <button type="button" className={cn(btn, 'text-ink-muted hover:bg-surface disabled:opacity-40')} disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page">
        <ChevronLeft className="size-4" />
      </button>
      {pages.map((p, i) =>
        p === '…' ? (
          <span key={`gap-${i}`} className="px-2 text-ink-subtle">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            aria-current={p === page ? 'page' : undefined}
            onClick={() => onChange(p)}
            className={cn(btn, p === page ? 'bg-brand-600 text-white shadow-sm' : 'text-ink-muted hover:bg-surface')}
          >
            {p}
          </button>
        ),
      )}
      <button type="button" className={cn(btn, 'text-ink-muted hover:bg-surface disabled:opacity-40')} disabled={page >= lastPage} onClick={() => onChange(page + 1)} aria-label="Next page">
        <ChevronRight className="size-4" />
      </button>
    </nav>
  )
}
