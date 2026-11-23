import { useState } from 'react'
import { Skeleton } from '@/components/ui'
import type { ProductCard as Card } from '../types'
import { ProductCard } from './ProductCard'
import { QuickViewModal } from './QuickViewModal'

export function ProductGrid({ products, loading, columns = 4, skeletons = 8 }: { products?: Card[]; loading?: boolean; columns?: 3 | 4 | 5; skeletons?: number }) {
  const [quick, setQuick] = useState<Card | null>(null)
  const cols = { 3: 'lg:grid-cols-3 xl:grid-cols-4', 4: 'lg:grid-cols-4', 5: 'lg:grid-cols-5 xl:grid-cols-6' }[columns]

  return (
    <>
      <ul className={`grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 ${cols}`} aria-busy={loading || undefined}>
        {loading && !products
          ? Array.from({ length: skeletons }, (_, i) => (
              <li key={i} className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
                <Skeleton className="aspect-square rounded-none" />
                <div className="space-y-2 p-4">
                  <Skeleton className="h-3 w-1/3" />
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-5 w-1/3" />
                </div>
              </li>
            ))
          : products?.map((p) => (
              <li key={p.id} className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
                <ProductCard product={p} onQuickView={setQuick} />
              </li>
            ))}
      </ul>
      <QuickViewModal product={quick} onClose={() => setQuick(null)} />
    </>
  )
}
