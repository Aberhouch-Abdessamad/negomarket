import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

export function StatCard({ icon: Icon, label, value, hint, tone = 'brand' }: { icon: LucideIcon; label: string; value: ReactNode; hint?: ReactNode; tone?: 'brand' | 'accent' | 'success' | 'warning' | 'danger' }) {
  const tones = {
    brand: 'bg-brand-50 text-brand-700 ring-brand-100',
    accent: 'bg-accent-50 text-accent-700 ring-accent-100',
    success: 'bg-success-50 text-success-600 ring-emerald-100',
    warning: 'bg-warning-50 text-warning-600 ring-amber-100',
    danger: 'bg-danger-50 text-danger-600 ring-red-100',
  }
  return (
    <div className="relative overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-ink-muted">{label}</p>
        <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl ring-1', tones[tone])}>
          <Icon className="size-5" aria-hidden />
        </span>
      </div>
      <p className="mt-2 text-xl font-extrabold leading-tight tracking-tight sm:text-[1.7rem]">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-subtle">{hint}</p>}
    </div>
  )
}
