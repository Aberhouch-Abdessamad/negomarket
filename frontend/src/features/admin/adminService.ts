import { api } from '@/services/api/client'
import type { Paginated } from '@/features/marketplace/types'
import type { SellerProduct, StoreApplication } from '@/features/seller/types'
import type {
  ActivityLogEntry,
  ActivityLogFilters,
  AdminNegotiationFilters,
  AdminOrderFilters,
  AdminOrderRow,
  AdminReview,
  AdminReviewFilters,
  AdminStore,
  AdminStoreFilters,
  AdminUser,
  AdminUserFilters,
  DashboardOverview,
  OrderDetail,
  PlatformSetting,
  SalesReport,
} from './types'
import type { NegotiationDetail, NegotiationSummary } from '@/features/negotiations/types'

const clean = (o: object) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== '' && v !== null))

async function page<T>(url: string, params: object = {}): Promise<Paginated<T>> {
  const res = await api.get<T[]>(url, clean(params))
  return { data: res.data, meta: res.meta as Paginated<T>['meta'] }
}

export const adminService = {
  async applications(params: { status?: string; q?: string; page?: number }) {
    const res = await api.get<StoreApplication[]>('/admin/seller-applications', clean(params))
    return { data: res.data, meta: res.meta as Paginated<StoreApplication>['meta'] & { pending_count: number } }
  },
  async approveApplication(id: number, notes?: string) {
    return (await api.patch<StoreApplication>(`/admin/seller-applications/${id}/approve`, { notes })).data
  },
  async rejectApplication(id: number, notes: string) {
    return (await api.patch<StoreApplication>(`/admin/seller-applications/${id}/reject`, { notes })).data
  },
  async moderationQueue(page = 1): Promise<Paginated<SellerProduct>> {
    const res = await api.get<SellerProduct[]>('/admin/products/moderation', { page })
    return { data: res.data, meta: res.meta as Paginated<SellerProduct>['meta'] }
  },
  async approveProduct(id: number) {
    return (await api.patch<SellerProduct>(`/admin/products/${id}/approve`)).data
  },
  async rejectProduct(id: number, reason: string) {
    return (await api.patch<SellerProduct>(`/admin/products/${id}/reject`, { reason })).data
  },

  // Dashboard and reporting
  async dashboard() {
    return (await api.get<DashboardOverview>('/admin/dashboard')).data
  },
  async salesReport(days = 30) {
    return (await api.get<SalesReport>('/admin/reports/sales', { days })).data
  },

  // Accounts
  users(filters: AdminUserFilters = {}) {
    return page<AdminUser>('/admin/users', filters)
  },
  async user(id: number) {
    return (await api.get<AdminUser>(`/admin/users/${id}`)).data
  },
  async updateUserStatus(id: number, status: AdminUser['status']) {
    return (await api.patch<AdminUser>(`/admin/users/${id}/status`, { status })).data
  },

  // Stores
  stores(filters: AdminStoreFilters = {}) {
    return page<AdminStore>('/admin/stores', filters)
  },
  async store(id: number) {
    return (await api.get<AdminStore>(`/admin/stores/${id}`)).data
  },
  async updateStoreStatus(id: number, status: AdminStore['status']) {
    return (await api.patch<AdminStore>(`/admin/stores/${id}/status`, { status })).data
  },

  // Orders
  orders(filters: AdminOrderFilters = {}) {
    return page<AdminOrderRow>('/admin/orders', filters)
  },
  async order(id: number) {
    return (await api.get<OrderDetail>(`/admin/orders/${id}`)).data
  },
  async updateOrderStatus(id: number, status: string, note?: string) {
    return (await api.patch<OrderDetail>(`/admin/orders/${id}/status`, clean({ status, note }))).data
  },
  async cancelOrder(id: number, reason?: string) {
    return (await api.post<OrderDetail>(`/admin/orders/${id}/cancel`, clean({ reason }))).data
  },

  // Negotiation monitoring
  negotiations(filters: AdminNegotiationFilters = {}) {
    return page<NegotiationSummary>('/admin/negotiations', filters)
  },
  async negotiation(id: number) {
    return (await api.get<NegotiationDetail>(`/admin/negotiations/${id}`)).data
  },

  // Reviews
  reviews(filters: AdminReviewFilters = {}) {
    return page<AdminReview>('/admin/reviews', filters)
  },
  async moderateReview(id: number, status: 'approved' | 'rejected') {
    return (await api.patch<AdminReview>(`/admin/reviews/${id}`, { status })).data
  },

  // Activity log
  activityLogs(filters: ActivityLogFilters = {}) {
    return page<ActivityLogEntry>('/admin/activity-logs', filters)
  },

  // Settings
  async settings() {
    return (await api.get<PlatformSetting[]>('/admin/settings')).data
  },
  async updateSettings(settings: Record<string, unknown>) {
    return (await api.put<PlatformSetting[]>('/admin/settings', { settings })).data
  },
}
