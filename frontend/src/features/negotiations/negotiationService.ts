import { api } from '@/services/api/client'
import type { Paginated } from '@/features/marketplace/types'
import type {
  NegotiationDetail,
  NegotiationMessage,
  NegotiationOffer,
  NegotiationStatus,
  NegotiationSummary,
  OfferPayload,
  StartNegotiationPayload,
} from './types'

const clean = (params: object) => Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''))

export interface NegotiationFilters {
  status?: NegotiationStatus | ''
  role?: 'customer' | 'seller' | ''
  q?: string
  page?: number
  per_page?: number
}

export const negotiationService = {
  async list(filters: NegotiationFilters = {}): Promise<Paginated<NegotiationSummary>> {
    const res = await api.get<NegotiationSummary[]>('/negotiations', clean(filters))
    return { data: res.data, meta: res.meta as Paginated<NegotiationSummary>['meta'] }
  },

  async get(id: number): Promise<NegotiationDetail> {
    return (await api.get<NegotiationDetail>(`/negotiations/${id}`)).data
  },

  async start(payload: StartNegotiationPayload): Promise<NegotiationDetail> {
    return (await api.post<NegotiationDetail>('/negotiations', payload)).data
  },

  async counter(id: number, payload: OfferPayload): Promise<NegotiationOffer> {
    return (await api.post<NegotiationOffer>(`/negotiations/${id}/offers`, payload)).data
  },

  async accept(id: number, offerId: number): Promise<NegotiationDetail> {
    return (await api.post<NegotiationDetail>(`/negotiations/${id}/offers/${offerId}/accept`)).data
  },

  async reject(id: number, offerId: number): Promise<NegotiationDetail> {
    return (await api.post<NegotiationDetail>(`/negotiations/${id}/offers/${offerId}/reject`)).data
  },

  async cancel(id: number, reason?: string): Promise<NegotiationDetail> {
    return (await api.post<NegotiationDetail>(`/negotiations/${id}/cancel`, { reason })).data
  },

  async messages(id: number, params: { before_id?: number; per_page?: number } = {}): Promise<NegotiationMessage[]> {
    return (await api.get<NegotiationMessage[]>(`/negotiations/${id}/messages`, clean(params))).data
  },

  async sendMessage(id: number, body: { message: string; client_message_id: string }): Promise<NegotiationMessage> {
    return (await api.post<NegotiationMessage>(`/negotiations/${id}/messages`, body)).data
  },

  async markRead(id: number): Promise<{ updated: number; unread_count: number }> {
    return (await api.post<{ updated: number; unread_count: number }>(`/negotiations/${id}/read`)).data
  },

  async unreadCount(): Promise<number> {
    return (await api.get<{ unread_count: number }>('/negotiations/unread-count')).data.unread_count
  },
}
