import type { Order } from '@/features/cart/types'
import type { OrderDetail } from '@/features/orders/types'
import type { Paginated } from '@/features/marketplace/types'
import type { NegotiationDetail, NegotiationSummary } from '@/features/negotiations/types'

export type { OrderDetail, NegotiationDetail, NegotiationSummary, Paginated }

export type AdminUserStatus = 'active' | 'suspended'
export type AdminStoreStatus = 'pending' | 'active' | 'suspended' | 'closed'
export type AdminReviewStatus = 'pending' | 'approved' | 'rejected'

export interface AdminUser {
  id: number
  name: string
  email: string
  phone: string | null
  status: AdminUserStatus
  status_label: string
  email_verified: boolean
  roles: string[]
  store: { id: number; name: string; slug: string; status: string } | null
  orders_count?: number
  reviews_count?: number
  negotiations_count?: number
  last_seen_at: string | null
  created_at: string | null
}

export interface AdminStore {
  id: number
  name: string
  slug: string
  description: string | null
  status: AdminStoreStatus
  status_label: string
  city: string | null
  phone: string | null
  email: string | null
  logo_url: string | null
  rating_avg: number
  rating_count: number
  owner?: { id: number; name: string; email: string } | null
  products_count?: number
  orders_count?: number
  approved_at: string | null
  created_at: string | null
}

export interface AdminReview {
  id: number
  rating: number
  comment: string | null
  status: AdminReviewStatus
  status_label: string
  author: { id: number; name: string; email: string } | null
  product: { id: number; name: string; slug: string; store: { id: number; name: string } | null } | null
  order: { id: number; reference_number: string } | null
  seller_reply: string | null
  seller_replied_at: string | null
  created_at: string | null
}

export interface ActivityLogEntry {
  id: number
  action: string
  user: { id: number; name: string; email: string } | null
  subject_type: string | null
  subject_id: number | null
  properties: Record<string, unknown> | null
  ip_address: string | null
  created_at: string | null
}

export interface PlatformSetting {
  key: string
  value: unknown
  default: unknown
}

export interface DailyPoint {
  date: string
  orders: number
  revenue: number
}

export interface DashboardOverview {
  users: { total: number; active: number; new_30d: number; sellers: number; admins: number }
  stores: { total: number; active: number }
  applications: { pending: number }
  products: { total: number; pending_review: number }
  orders: { total: number; pending: number; last_30d: number; revenue_total: number; revenue_30d: number }
  payments: { collected_total: number; uncollected_total: number }
  negotiations: { active: number }
  disputes: { open: number; resolved_30d: number }
  reviews: { pending: number; approved: number }
  recent_orders: {
    id: number
    reference_number: string
    status: string
    status_label: string
    total_amount: number
    store: { id: number; name: string } | null
    customer: { id: number; name: string } | null
    created_at: string | null
  }[]
  sales_series: DailyPoint[]
}

export interface SalesReport {
  range: { days: number; from: string; to: string }
  totals: {
    orders: number
    revenue: number
    average_order_value: number
    collected: number
    uncollected: number
  }
  status_breakdown: Record<string, number>
  top_stores: { id: number; name: string; orders_count: number; revenue: number }[]
  top_products: { id: number; name: string; quantity: number; revenue: number }[]
  sales_series: DailyPoint[]
}

/** Row shape returned by GET /admin/orders (the list omits status history). */
export type AdminOrderRow = Omit<Order, 'status_history'>

export interface AdminUserFilters {
  status?: AdminUserStatus
  role?: 'customer' | 'seller' | 'admin'
  q?: string
  page?: number
}

export interface AdminStoreFilters {
  status?: AdminStoreStatus
  q?: string
  page?: number
}

export interface AdminOrderFilters {
  status?: string
  store_id?: number
  customer_id?: number
  q?: string
  page?: number
}

export interface AdminNegotiationFilters {
  status?: string
  store_id?: number
  customer_id?: number
  q?: string
  page?: number
}

export interface AdminReviewFilters {
  status?: AdminReviewStatus
  rating?: number
  store_id?: number
  q?: string
  page?: number
}

export interface ActivityLogFilters {
  action?: string
  user_id?: number
  subject_type?: string
  from?: string
  to?: string
  q?: string
  page?: number
}

export type PlatformOrder = OrderDetail
