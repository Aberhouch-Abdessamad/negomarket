import { Link } from 'react-router'
import { cn } from '@/utils/cn'
import { env } from '@/utils/env'

/** NegoMarket wordmark: "N" monogram with an amber "offer" dot. */
export function Logo({ className, inverted = false, onClick, to = '/' }: { className?: string; inverted?: boolean; onClick?: () => void; to?: string }) {
  return (
    <Link to={to} onClick={onClick} className={cn('flex shrink-0 items-center gap-2', className)} aria-label={`${env.appName} home`}>
      <svg viewBox="0 0 64 64" className="size-9" aria-hidden>
        <rect width="64" height="64" rx="16" fill={inverted ? '#ffffff' : 'var(--color-brand-600)'} />
        <path d="M18 40V24l14 16V24" fill="none" stroke={inverted ? 'var(--color-brand-700)' : '#fff'} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="46" cy="24" r="5" fill="var(--color-accent-400)" />
      </svg>
      <span className={cn('text-xl font-extrabold tracking-tight', inverted ? 'text-white' : 'text-ink')}>
        Nego<span className={inverted ? 'text-accent-400' : 'text-brand-600'}>Market</span>
      </span>
    </Link>
  )
}
