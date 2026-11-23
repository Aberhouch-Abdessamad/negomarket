export type ProductStatus = 'draft' | 'pending_review' | 'published' | 'rejected' | 'archived'

export interface SellerVariant {
  id: number
  sku: string
  attributes: Record<string, string>
  price: number | null
  stock_quantity: number
  status: 'active' | 'inactive'
}

export interface SellerProduct {
  id: number
  name: string
  slug: string
  sku: string
  description: string | null
  category: { id: number; name: string } | null
  category_id: number
  store?: { id: number; name: string; slug: string }
  price: number
  minimum_price: number | null
  allow_negotiation: boolean
  stock_quantity: number
  status: ProductStatus
  rejection_reason: string | null
  featured: boolean
  views_count: number
  sales_count: number
  rating_avg: number
  images?: { id: number; url: string; thumbnail_url: string; sort_order: number }[]
  primary_image_url?: string | null
  variants?: SellerVariant[]
  published_at: string | null
  updated_at: string | null
  created_at: string | null
}

export interface ProductPayload {
  name: string
  sku: string
  category_id: number
  description?: string
  price: number
  allow_negotiation: boolean
  minimum_price?: number | null
  stock_quantity?: number
  variants?: { id?: number; sku: string; attributes: Record<string, string>; price?: number | null; stock_quantity: number; status?: string }[]
}

export interface StoreApplication {
  id: number
  business_name: string
  description: string
  contact_phone: string
  address: string
  city: string
  status: 'pending' | 'approved' | 'rejected'
  admin_notes: string | null
  reviewed_at: string | null
  created_at: string
  applicant?: { id: number; name: string; email: string; email_verified: boolean; member_since: string }
  reviewer?: string | null
  store?: { id: number; slug: string; status: string } | null
}

export interface StoreAddress {
  id: number
  type: 'business' | 'pickup'
  label: string | null
  contact_name: string | null
  phone: string | null
  address_line1: string
  address_line2: string | null
  city: string
  region: string | null
  postal_code: string | null
  country: string
  is_default: boolean
}

export interface SellerStore {
  id: number
  name: string
  slug: string
  description: string | null
  logo_url: string | null
  banner_url: string | null
  phone: string | null
  email: string | null
  address: string | null
  city: string | null
  status: string
  rating_avg: number
  rating_count: number
  approved_at: string | null
  addresses: StoreAddress[]
}

export interface DailyPoint {
  date: string
  orders: number
  revenue: number
}

export interface SellerDashboard {
  kpis: {
    revenue_30d: number
    orders_30d: number
    pending_orders: number
    cod_to_collect: number
    cod_collected_30d: number
    active_negotiations: number
    offers_awaiting_reply: number
    product_views: number
    rating_avg: number
    rating_count: number
  }
  products: { by_status: Record<ProductStatus, number>; low_stock: number; out_of_stock: number }
  orders_by_status: Record<string, number>
  low_stock_products: { id: number; name: string; sku: string; stock_quantity: number; status: ProductStatus }[]
  recent_orders: { id: number; reference_number: string; customer: string | null; total_amount: number; status: string; created_at: string }[]
  sales_last_30_days: DailyPoint[]
}

export interface SellerAnalytics {
  period_days: number
  totals: { revenue: number; orders: number; average_order_value: number }
  series: DailyPoint[]
  top_products: { product_id: number; name: string; units: number; revenue: number; negotiated_lines: number }[]
  negotiations: { total: number; accepted: number; conversion_rate: number; by_status: Record<string, number>; average_discount_percent: number }
}

export interface InventoryRow {
  product_id: number
  name: string
  sku: string
  status: ProductStatus
  image_url: string | null
  stock_quantity: number
  variants: { id: number; sku: string; attributes: Record<string, string>; stock_quantity: number }[]
}

export interface InventoryMovement {
  id: number
  type: 'initial' | 'restock' | 'adjustment' | 'sale' | 'cancellation_restore' | 'return_restore'
  quantity_change: number
  quantity_before: number
  quantity_after: number
  product?: { id: number; name: string; sku: string }
  variant?: { id: number; sku: string; attributes: Record<string, string> } | null
  reference: { type: string; id: number } | null
  actor?: string | null
  note: string | null
  created_at: string
}

export interface SellerReview {
  id: number
  rating: number
  comment: string | null
  status: string
  author: string | null
  product: { id: number; name: string; slug: string }
  seller_reply: string | null
  seller_replied_at: string | null
  created_at: string
}
