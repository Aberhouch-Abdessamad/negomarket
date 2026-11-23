import { cn } from '@/utils/cn'

export function Tabs<T extends string>({ value, onChange, items, label }: { value: T; onChange: (v: T) => void; items: { value: T; label: string; count?: number }[]; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex flex-wrap gap-1 rounded-xl bg-canvas p-1 ring-1 ring-line">
      {items.map((it) => (
        <button
          key={it.value}
          type="button"
          role="tab"
          aria-selected={value === it.value}
          onClick={() => onChange(it.value)}
          className={cn('rounded-lg px-3 py-1.5 text-sm font-medium transition', value === it.value ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink')}
        >
          {it.label}
          {it.count !== undefined && <span className="ml-1.5 text-xs text-ink-subtle">{it.count}</span>}
        </button>
      ))}
    </div>
  )
}
