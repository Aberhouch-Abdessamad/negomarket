import { useEffect, useState } from 'react'
import { marketplaceService } from '@/features/marketplace/marketplaceService'
import type { Category } from '@/features/marketplace/types'

let cache: Category[] | null = null
let inflight: Promise<Category[]> | null = null

/** Category tree shared by the header, mega-menu and filters (fetched once per page load). */
export function useCategories(): Category[] | null {
  const [data, setData] = useState<Category[] | null>(cache)

  useEffect(() => {
    if (cache) return
    let active = true
    inflight ??= marketplaceService.categories().then((c) => (cache = c)).finally(() => { inflight = null })
    inflight.then((c) => active && setData(c)).catch(() => {})
    return () => {
      active = false
    }
  }, [])

  return data
}

/** Test helper. */
export function resetCategoriesCache() {
  cache = null
  inflight = null
}
