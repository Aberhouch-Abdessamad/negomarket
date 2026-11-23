import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'
import type { ProductFilters } from './types'

const KEYS: (keyof ProductFilters)[] = ['q', 'category', 'store', 'min_price', 'max_price', 'negotiable', 'min_rating', 'in_stock', 'sort', 'page']

/** Filters live in the URL so listings are shareable and the back button works. */
export function useProductFilters(fixed: Partial<ProductFilters> = {}) {
  const [params, setParams] = useSearchParams()

  const filters = useMemo(() => {
    const f: ProductFilters = {}
    for (const k of KEYS) {
      const v = params.get(k)
      if (v) (f as Record<string, string>)[k] = v
    }
    return { ...f, ...fixed }
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- fixed is compared by value
  }, [params, JSON.stringify(fixed)])

  const update = useCallback(
    (patch: Partial<ProductFilters>) => {
      setParams((prev) => {
        const next = new URLSearchParams(prev)
        for (const [k, v] of Object.entries(patch)) {
          if (v === undefined || v === '') next.delete(k)
          else next.set(k, String(v))
        }
        if (!('page' in patch)) next.delete('page') // any filter change returns to page 1
        return next
      })
    },
    [setParams],
  )

  const reset = useCallback(() => setParams(params.get('q') ? { q: params.get('q')! } : {}), [params, setParams])

  const activeCount = KEYS.filter((k) => !['sort', 'page', 'q'].includes(k) && params.get(k)).length

  return { filters, update, reset, activeCount }
}
