import type { Paginated } from '@/features/marketplace/types'
import { api } from '@/services/api/client'
import type {
  Dispute,
  DisputeFilters,
  OrderDetail,
  OrderFilters,
  ReviewPayload,
  ReviewResult,
} from './types'

const clean = (o: object) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== ''))

async function page<T>(url: string, params: object = {}): Promise<Paginated<T>> {
  const res = await api.get<T[]>(url, clean(params))
  return { data: res.data, meta: res.meta as Paginated<T>['meta'] }
}

/**
 * Customer and seller order endpoints. All prices, statuses and totals come
 * from the API; the UI only ever sends the action, never a computed value.
 */
export const orderService = {
  // Customer
  customerOrders(filters: OrderFilters = {}) {
    return page<OrderDetail>('/orders', filters)
  },
  async order(id: number) {
    return (await api.get<OrderDetail>(`/orders/${id}`)).data
  },
  async cancel(id: number, reason?: string) {
    return (await api.post<OrderDetail>(`/orders/${id}/cancel`, reason ? { reason } : {})).data
  },
  async confirmReceipt(id: number) {
    return (await api.post<OrderDetail>(`/orders/${id}/receipt`)).data
  },
  async review(id: number, payload: ReviewPayload) {
    return (await api.post<ReviewResult>(`/orders/${id}/reviews`, payload)).data
  },
  async openDispute(id: number, payload: { reason: string; description: string }) {
    return (await api.post<Dispute>(`/orders/${id}/disputes`, payload)).data
  },

  // Disputes (shared by the customer, the seller and admins)
  disputes(filters: DisputeFilters = {}) {
    return page<Dispute>('/disputes', filters)
  },
  async dispute(id: number) {
    return (await api.get<Dispute>(`/disputes/${id}`)).data
  },
  async message(id: number, message: string) {
    return (await api.post<Dispute>(`/disputes/${id}/messages`, { message })).data
  },
  async resolveDispute(id: number, payload: { status: string; resolution?: string }) {
    return (await api.patch<Dispute>(`/admin/disputes/${id}`, payload)).data
  },

  // Seller
  sellerOrders(filters: OrderFilters = {}) {
    return page<OrderDetail>('/seller/orders', filters)
  },
  async sellerOrder(id: number) {
    return (await api.get<OrderDetail>(`/seller/orders/${id}`)).data
  },
  async updateStatus(id: number, status: string, note?: string) {
    return (await api.patch<OrderDetail>(`/seller/orders/${id}/status`, clean({ status, note }))).data
  },
  async sellerCancel(id: number, reason?: string) {
    return (await api.post<OrderDetail>(`/seller/orders/${id}/cancel`, reason ? { reason } : {})).data
  },
  async collectPayment(id: number, notes?: string) {
    return (await api.post<OrderDetail>(`/seller/orders/${id}/payment/collect`, notes ? { notes } : {})).data
  },
}
