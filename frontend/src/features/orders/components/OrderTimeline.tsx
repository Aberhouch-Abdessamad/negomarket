import { CheckCircle2, Circle, Clock } from 'lucide-react'
import type { OrderStatusEntry } from '../types'
import { formatDate } from '@/utils/format'

/** Vertical status history. Entries are written by the API on every change. */
export function OrderTimeline({ entries }: { entries: OrderStatusEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-ink-muted">No status updates yet.</p>
  }

  return (
    <ol className="space-y-4">
      {entries.map((entry, index) => {
        const latest = index === entries.length - 1
        return (
          <li key={entry.id} className="flex gap-3">
            <span className={latest ? 'mt-0.5 text-brand-600' : 'mt-0.5 text-ink-subtle'}>
              {latest ? <Clock className="size-4" aria-hidden /> : <CheckCircle2 className="size-4" aria-hidden />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{entry.to_status_label}</p>
              {entry.note && <p className="text-sm text-ink-muted">{entry.note}</p>}
              <p className="mt-0.5 text-xs text-ink-subtle">
                {entry.created_at ? formatDate(entry.created_at) : ''}
                {entry.changed_by_name ? ` · ${entry.changed_by_name}` : ''}
              </p>
            </div>
          </li>
        )
      })}
      {entries.length === 0 && (
        <li className="flex items-center gap-2 text-sm text-ink-muted">
          <Circle className="size-3" aria-hidden /> Waiting for the first update
        </li>
      )}
    </ol>
  )
}
