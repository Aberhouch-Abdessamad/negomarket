import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useRef, useState } from 'react'
import { Skeleton } from '@/components/ui'
import type { ProductCard as Card } from '../types'
import { ProductCard } from './ProductCard'
import { QuickViewModal } from './QuickViewModal'

/** Horizontally scrolling product carousel with snap points and arrow controls. */
export function ProductRail({ products, loading, label }: { products?: Card[]; loading?: boolean; label: string }) {
  const ref = useRef<HTMLUListElement>(null)
  const [quick, setQuick] = useState<Card | null>(null)
  const scroll = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.85, behavior: 'smooth' })

  return (
    <div className="relative">
      <ul ref={ref} aria-label={label} className="scrollbar-none -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:gap-4 lg:mx-0 lg:px-0">
        {loading && !products
          ? Array.from({ length: 6 }, (_, i) => (
              <li key={i} className="w-[46%] shrink-0 snap-start sm:w-[31%] lg:w-[calc((100%-5rem)/6)]"><Skeleton className="aspect-[3/4]" /></li>
            ))
          : products?.map((p) => (
              <li key={p.id} className="w-[46%] shrink-0 snap-start sm:w-[31%] md:w-[23.5%] lg:w-[calc((100%-5rem)/6)]">
                <ProductCard product={p} onQuickView={setQuick} />
              </li>
            ))}
      </ul>
      {(products?.length ?? 0) > 4 && (
        <>
          <button type="button" onClick={() => scroll(-1)} aria-label={`Scroll ${label} left`} className="absolute -left-4 top-1/3 hidden size-10 place-items-center rounded-full bg-surface shadow-[var(--shadow-pop)] ring-1 ring-line hover:bg-canvas lg:grid"><ChevronLeft className="size-5" /></button>
          <button type="button" onClick={() => scroll(1)} aria-label={`Scroll ${label} right`} className="absolute -right-4 top-1/3 hidden size-10 place-items-center rounded-full bg-surface shadow-[var(--shadow-pop)] ring-1 ring-line hover:bg-canvas lg:grid"><ChevronRight className="size-5" /></button>
        </>
      )}
      <QuickViewModal product={quick} onClose={() => setQuick(null)} />
    </div>
  )
}
