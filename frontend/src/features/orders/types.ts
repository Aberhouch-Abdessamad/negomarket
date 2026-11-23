import type { Order } from '@/features/cart/types'

export type {
  AddressSnapshot,
  Order,
  OrderGroup,
  OrderItem,
  OrderStatusEntry,
  PaymentInfo,
} from '@/features/cart/types'

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'returned'

export type DisputeStatus = 'open' | 'under_review' | 'resolved' | 'rejected' | 'closed'

export const DISPUTE_REASONS = [
  { value: 'item_not_received', label: 'Item not received' },
  { value: 'item_damaged', label: 'Item arrived damaged' },
  { value: 'wrong_item', label: 'Wrong item received' },
  { value: 'not_as_described', label: 'Not as described' },
  { value: 'other', label: 'Something else' },
] as const

export type DisputeReason = (typeof DISPUTE_REASONS)[number]['value']

export interface DisputeMessage {
  id: number
  message: string
  sender: { id: number; name: string } | null
  created_at: string | null
}

export interface Dispute {
  id: number
  order_id: number
  order_reference: string | null
  order: {
    id: number
    reference_number: string
    status: string
    status_label: string
    total_amount: number
    store: { id: number; name: string; slug: string } | null
  } | null
  reason: string
  reason_label: string
  description: string
  status: DisputeStatus
  status_label: string
  resolution: string | null
  opened_by: { id: number; name: string } | null
  resolved_by: { id: number; name: string } | null
  resolved_at: string | null
  messages: DisputeMessage[]
  created_at: string | null
  updated_at: string | null
}

/** Detail payload: the order plus its (rarely more than one) disputes. */
export interface OrderDetail extends Order {
  disputes: Dispute[]
}

export interface ReviewPayload {
  order_item_id: number
  rating: number
  comment?: string
}

export interface ReviewResult {
  id: number
  order_item_id: number
  product_id: number
  rating: number
  comment: string | null
  status: 'pending' | 'approved' | 'rejected'
  status_label: string
  created_at: string | null
}

export interface OrderFilters {
  status?: OrderStatus
  store_id?: number
  q?: string
  page?: number
  per_page?: number
}

export interface DisputeFilters {
  status?: DisputeStatus
  order_id?: number
  page?: number
}
