import { MessagesSquare } from 'lucide-react'
import { useEffect } from 'react'
import { Link, useLocation } from 'react-router'
import { useNegotiationBadgeStore } from '@/features/negotiations/negotiationBadgeStore'
import { cn } from '@/utils/cn'

/**
 * Header shortcut to negotiations with the unread-message badge. The API is
 * polled gently and on tab focus; the thread page refreshes it after reads.
 */
export function NegotiationBell() {
  const unread = useNegotiationBadgeStore((s) => s.unread)
  const refresh = useNegotiationBadgeStore((s) => s.refresh)
  const pathname = useLocation().pathname

  useEffect(() => {
    void refresh()
    const interval = window.setInterval(() => void refresh(), 30_000)
    const onFocus = () => void refresh()
    const onRead = () => void refresh()
    window.addEventListener('focus', onFocus)
    window.addEventListener('negotiations:read', onRead)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('negotiations:read', onRead)
    }
  }, [refresh])

  return (
    <Link
      to="/negotiations"
      className={cn(
        'relative rounded-lg p-2 text-ink-muted hover:bg-canvas hover:text-ink',
        pathname.startsWith('/negotiations') && 'bg-brand-50 text-brand-700',
      )}
      aria-label={`Negotiations${unread > 0 ? ` (${unread} unread)` : ''}`}
    >
      <MessagesSquare className="size-5" />
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-danger-600 px-1 text-[10px] font-semibold text-white">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </Link>
  )
}
