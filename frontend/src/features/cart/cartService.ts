import { api, http } from '@/services/api/client'
import type { ApiSuccess } from '@/services/api/types'
import type { AddCartItemPayload, CartSummary, CheckoutPayload, CheckoutPreview, OrderGroup } from './types'

/** Fresh idempotency key for one checkout attempt. */
export function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export const cartService = {
  async summary(): Promise<CartSummary> {
    return (await api.get<CartSummary>('/cart')).data
  },

  async add(payload: AddCartItemPayload): Promise<CartSummary> {
    return (await api.post<CartSummary>('/cart/items', payload)).data
  },

  async updateQuantity(itemId: number, quantity: number): Promise<CartSummary> {
    return (await api.put<CartSummary>(`/cart/items/${itemId}`, { quantity })).data
  },

  async remove(itemId: number): Promise<CartSummary> {
    return (await api.delete<CartSummary>(`/cart/items/${itemId}`)).data
  },

  async preview(payload: CheckoutPayload): Promise<CheckoutPreview> {
    return (await api.post<CheckoutPreview>('/checkout/preview', payload)).data
  },

  /** Place the order. The Idempotency-Key makes retries safe. */
  async place(payload: CheckoutPayload, idempotencyKey: string): Promise<OrderGroup> {
    const { data } = await http.post<ApiSuccess<OrderGroup>>('/api/v1/checkout', payload, {
      headers: { 'Idempotency-Key': idempotencyKey },
    })
    return data.data
  },
}
