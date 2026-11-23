import { Heart } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router'
import { useAuthStore } from '@/store/authStore'
import { useWishlistStore } from '@/store/wishlistStore'
import { cn } from '@/utils/cn'

export function WishlistButton({ productId, className }: { productId: number; className?: string }) {
  const authed = useAuthStore((s) => s.status === 'authenticated')
  const saved = useWishlistStore((s) => s.ids.has(productId))
  const toggle = useWishlistStore((s) => s.toggle)
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={saved ? 'Remove from wishlist' : 'Save to wishlist'}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        if (!authed) return navigate(`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`)
        void toggle(productId)
      }}
      className={cn('grid size-9 place-items-center rounded-full bg-surface/95 shadow-sm ring-1 ring-line transition hover:scale-105', className)}
    >
      <Heart className={cn('size-4', saved ? 'fill-rose-500 text-rose-500' : 'text-ink-muted')} />
    </button>
  )
}
