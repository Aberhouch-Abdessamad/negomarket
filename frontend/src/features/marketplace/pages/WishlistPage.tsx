import { Heart } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { Alert, Button, EmptyState, Pagination } from '@/components/ui'
import { useAsync } from '@/hooks/useAsync'
import { useWishlistStore } from '@/store/wishlistStore'
import { ProductGrid } from '../components/ProductGrid'
import { wishlistService } from '../marketplaceService'

export default function WishlistPage() {
  const [page, setPage] = useState(1)
  const count = useWishlistStore((s) => s.ids.size)
  const { data, loading, error, reload } = useAsync(() => wishlistService.list(page), [page, count])
  const products = data?.data.filter((p) => useWishlistStore.getState().ids.has(p.id) || !useWishlistStore.getState().loaded)

  return (
    <div className="mx-auto max-w-[90rem] px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Wishlist</h1>
      <p className="mt-1 text-ink-muted">Products you saved for later.</p>
      <div className="mt-8">
        {error && (
          <Alert
            tone="danger"
            title="Could not load your wishlist"
            className="mb-5"
            action={<Button size="sm" variant="secondary" onClick={reload}>Retry</Button>}
          >
            {error.message}
          </Alert>
        )}
        {products && products.length === 0 ? (
          <EmptyState icon={Heart} title="Your wishlist is empty" message="Tap the heart on any product to save it here." action={<Link to="/products" className="text-sm font-medium text-brand-600">Browse the marketplace →</Link>} />
        ) : (
          <ProductGrid products={products} loading={loading} />
        )}
        {data && <div className="mt-10"><Pagination page={data.meta.current_page} lastPage={data.meta.last_page} onChange={setPage} /></div>}
      </div>
    </div>
  )
}
