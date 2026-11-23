export interface CartProduct {
  id: number
  name: string
  slug: string
  price: number
  thumbnail_url: string | null
  allow_negotiation: boolean
  status: string
}

export interface CartVariant {
  id: number
  sku: string
  attributes: Record<string, string>
  price: number
  stock_quantity: number
  status: string
}

export interface CartStore {
  id: number
  name: string
  slug: string
  logo_url: string | null
}

/** A resolved cart line. Prices and availability always come from the API. */
export interface CartLine {
  id: number
  quantity: number
  unit_price: number
  original_price: number
  line_total: number
  stock_quantity: number
  available: boolean
  issues: string[]
  is_negotiated: boolean
  negotiation_id: number | null
  product: CartProduct
  variant: CartVariant | null
  store: CartStore | null
}

export interface CartGroup {
  store: CartStore
  items: CartLine[]
  subtotal: number
  shipping_cost: number
  total: number
}

export interface CartSummary {
  id: number
  items: CartLine[]
  groups: CartGroup[]
  item_count: number
  total_quantity: number
  subtotal: number
  shipping_total: number
  total: number
  currency: string
  payment_method: string
  has_issues: boolean
}

export interface AddCartItemPayload {
  product_id?: number
  product_variant_id?: number | null
  negotiation_id?: number
  quantity?: number
}

export interface AddressSnapshot {
  full_name: string
  phone: string
  address_line1: string
  address_line2?: string | null
  city: string
  region?: string | null
  postal_code?: string | null
  country?: string
  delivery_notes?: string | null
}

/** A line inside a checkout preview (no cart row id for negotiated lines). */
export interface CheckoutLine {
  key: string
  cart_item_id: number | null
  negotiation_id: number | null
  quantity: number
  unit_price: number
  original_price: number
  line_total: number
  is_negotiated: boolean
  product: { id: number; name: string; slug: string; thumbnail_url: string | null }
  variant: { id: number; sku: string; attributes: Record<string, string> } | null
  store: CartStore
}

export interface CheckoutGroup {
  store: CartStore
  items: CheckoutLine[]
  subtotal: number
  shipping_cost: number
  total: number
}

export interface CheckoutSummary {
  item_count: number
  total_quantity: number
  subtotal: number
  shipping_total: number
  total: number
  currency: string
  payment_method: string
}

export interface CheckoutPreview {
  lines: CheckoutLine[]
  groups: CheckoutGroup[]
  summary: CheckoutSummary
  address: AddressSnapshot | null
}

export interface CheckoutPayload {
  address_id?: number
  address?: AddressSnapshot
  negotiation_ids?: number[]
  customer_notes?: string
}

export interface PaymentInfo {
  id: number
  method: string
  method_label: string
  status: string
  status_label: string
  amount: number
  collected_at: string | null
  collected_by: number | null
  collector_name: string | null
}

export interface OrderStatusEntry {
  id: number
  from_status: string | null
  to_status: string
  to_status_label: string
  note: string | null
  changed_by: number | null
  changed_by_name: string | null
  created_at: string | null
}

export interface OrderItem {
  id: number
  product_id: number
  product_name: string
  product_slug: string | null
  thumbnail_url: string | null
  sku: string | null
  variant_attributes: Record<string, string> | null
  quantity: number
  original_price: number
  unit_price: number
  total_price: number
  is_negotiated: boolean
  negotiation_id: number | null
  reviewed: boolean | null
}

export interface Order {
  id: number
  order_group_id: number
  reference_number: string
  status: string
  status_label: string
  store: CartStore
  customer?: { id: number; name: string; email: string; phone: string | null }
  subtotal: number
  shipping_cost: number
  discount: number
  total_amount: number
  customer_notes: string | null
  items: OrderItem[]
  address: AddressSnapshot | null
  payment: PaymentInfo | null
  status_history: OrderStatusEntry[]
  confirmed_at: string | null
  shipped_at: string | null
  delivered_at: string | null
  received_at: string | null
  cancelled_at: string | null
  cancellation_reason: string | null
  created_at: string | null
  updated_at: string | null
}

export interface OrderGroup {
  id: number
  reference_number: string
  status: string
  status_label: string
  payment_method: string
  payment_method_label: string
  subtotal: number
  shipping_total: number
  discount_total: number
  total_amount: number
  order_count: number | null
  orders: Order[]
  created_at: string | null
}
