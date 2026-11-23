import { create } from 'zustand'
import { cartService } from '@/features/cart/cartService'
import type { AddCartItemPayload, CartSummary } from '@/features/cart/types'
import { ApiError } from '@/services/api/types'
import { toast } from './toastStore'

interface CartState {
  summary: CartSummary | null
  loading: boolean
  loaded: boolean
  load: () => Promise<void>
  add: (payload: AddCartItemPayload) => Promise<boolean>
  updateQuantity: (itemId: number, quantity: number) => Promise<boolean>
  remove: (itemId: number) => Promise<void>
  setSummary: (summary: CartSummary) => void
  reset: () => void
}

const messageOf = (error: unknown, fallback: string) =>
  error instanceof ApiError ? (Object.values(error.errors)[0]?.[0] ?? error.message) : fallback

/**
 * Cart state shared by the header badge, the cart page and checkout.
 * The API is always the source of truth: every mutation returns the full,
 * freshly priced cart, which replaces the local copy.
 */
export const useCartStore = create<CartState>((set, get) => ({
  summary: null,
  loading: false,
  loaded: false,

  load: async () => {
    if (get().loading) return
    set({ loading: true })
    try {
      set({ summary: await cartService.summary(), loaded: true })
    } catch {
      // Signed-out visitors, or the API is down: the badge simply stays hidden.
      set({ loaded: true })
    } finally {
      set({ loading: false })
    }
  },

  add: async (payload) => {
    try {
      const summary = await cartService.add(payload)
      set({ summary })
      toast.success('Added to cart.')
      return true
    } catch (error) {
      toast.error(messageOf(error, 'Could not add this item to the cart.'))
      return false
    }
  },

  updateQuantity: async (itemId, quantity) => {
    try {
      set({ summary: await cartService.updateQuantity(itemId, quantity) })
      return true
    } catch (error) {
      toast.error(messageOf(error, 'Could not update the quantity.'))
      return false
    }
  },

  remove: async (itemId) => {
    try {
      set({ summary: await cartService.remove(itemId) })
      toast.info('Item removed from cart.')
    } catch (error) {
      toast.error(messageOf(error, 'Could not remove the item.'))
    }
  },

  setSummary: (summary) => set({ summary }),
  reset: () => set({ summary: null, loaded: false }),
}))
