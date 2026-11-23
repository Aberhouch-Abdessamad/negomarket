import { create } from 'zustand'
import { wishlistService } from '@/features/marketplace/marketplaceService'
import { toast } from './toastStore'

interface WishlistState {
  ids: Set<number>
  loaded: boolean
  load: () => Promise<void>
  toggle: (productId: number) => Promise<void>
  reset: () => void
}

/** Wishlist membership for heart icons, with optimistic updates rolled back on failure. */
export const useWishlistStore = create<WishlistState>((set, get) => ({
  ids: new Set(),
  loaded: false,
  load: async () => {
    try {
      set({ ids: new Set(await wishlistService.ids()), loaded: true })
    } catch {
      set({ loaded: true })
    }
  },
  toggle: async (productId) => {
    const had = get().ids.has(productId)
    const next = new Set(get().ids)
    if (had) next.delete(productId)
    else next.add(productId)
    set({ ids: next })
    try {
      if (had) await wishlistService.remove(productId)
      else await wishlistService.add(productId)
      toast.success(had ? 'Removed from your wishlist.' : 'Saved to your wishlist.')
    } catch {
      const rollback = new Set(get().ids)
      if (had) rollback.add(productId)
      else rollback.delete(productId)
      set({ ids: rollback })
      toast.error('Could not update your wishlist.')
    }
  },
  reset: () => set({ ids: new Set(), loaded: false }),
}))
