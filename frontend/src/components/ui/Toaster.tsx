import { CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { useToastStore } from '@/store/toastStore'
import { cn } from '@/utils/cn'

const icons = { success: CheckCircle2, error: XCircle, info: Info }

export function Toaster() {
  const { toasts, dismiss } = useToastStore()

  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:items-end sm:px-6">
      {toasts.map((t) => {
        const Icon = icons[t.tone]
        return (
          <div
            key={t.id}
            role="status"
            className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-line bg-surface p-3.5 text-sm shadow-lg"
          >
            <Icon className={cn('mt-0.5 size-4 shrink-0', { success: 'text-success-600', error: 'text-danger-600', info: 'text-brand-600' }[t.tone])} aria-hidden />
            <p className="flex-1 text-ink">{t.message}</p>
            <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss" className="text-ink-subtle hover:text-ink">
              <X className="size-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
