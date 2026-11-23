import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

type Tone = 'info' | 'success' | 'warning' | 'danger'

const styles: Record<Tone, { box: string; Icon: typeof Info }> = {
  info: { box: 'bg-brand-50 text-brand-900 ring-brand-200', Icon: Info },
  success: { box: 'bg-success-50 text-emerald-900 ring-emerald-200', Icon: CheckCircle2 },
  warning: { box: 'bg-warning-50 text-amber-900 ring-amber-200', Icon: AlertTriangle },
  danger: { box: 'bg-danger-50 text-red-900 ring-red-200', Icon: XCircle },
}

export function Alert({ tone = 'info', title, children, action, className }: { tone?: Tone; title?: string; children?: ReactNode; action?: ReactNode; className?: string }) {
  const { box, Icon } = styles[tone]
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cn('flex gap-3 rounded-xl p-3.5 text-sm ring-1 ring-inset', box, className)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && 'mt-0.5')}>{children}</div>}
      </div>
      {action}
    </div>
  )
}
