import { cn } from '@/utils/cn'

export function Avatar({ name, src, size = 'md', className }: { name: string; src?: string | null; size?: 'sm' | 'md' | 'lg' | 'xl'; className?: string }) {
  const sizes = { sm: 'size-8 text-xs', md: 'size-9 text-sm', lg: 'size-12 text-base', xl: 'size-20 text-2xl' }
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')

  return src ? (
    <img src={src} alt={name} className={cn('shrink-0 rounded-full object-cover ring-2 ring-surface', sizes[size], className)} />
  ) : (
    <span aria-hidden className={cn('grid shrink-0 place-items-center rounded-full bg-brand-100 font-semibold text-brand-700', sizes[size], className)}>
      {initials || '?'}
    </span>
  )
}
