export type NegotiationStatus = 'active' | 'accepted' | 'rejected' | 'expired' | 'cancelled' | 'converted_to_order'
export type OfferStatus = 'pending' | 'accepted' | 'rejected' | 'countered' | 'expired' | 'withdrawn'
export type OfferSenderRole = 'customer' | 'seller'
export type NegotiationRole = 'customer' | 'seller'

export interface NegotiationParty {
  id: number
  name: string
  avatar_url: string | null
}

export interface NegotiationProduct {
  id: number
  name: string
  slug: string
  price: number
  image_url: string | null
  /** Detail responses add these; inbox rows send the compact product only. */
  sku?: string
  allow_negotiation?: boolean
  stock_quantity?: number
  status?: string
  thumbnail_url?: string | null
}

export interface NegotiationVariant {
  id: number
  sku: string
  attributes: Record<string, string>
  price: number
  /** Detail responses add stock/status; inbox rows do not need them. */
  stock_quantity?: number
  status?: string
}

export interface NegotiationStore {
  id: number
  name: string
  slug: string
  logo_url: string | null
}

export interface NegotiationOffer {
  id: number
  negotiation_id: number
  amount: number
  status: OfferStatus
  status_label: string
  sender_role: OfferSenderRole
  sender_id: number
  sender?: NegotiationParty
  parent_offer_id: number | null
  message: string | null
  expires_at: string | null
  is_expired: boolean
  responded_at: string | null
  responded_by: number | null
  created_at: string | null
}

export interface NegotiationSummary {
  id: number
  status: NegotiationStatus
  status_label: string
  role: NegotiationRole
  quantity: number
  product: NegotiationProduct
  variant: NegotiationVariant | null
  store: NegotiationStore
  customer: NegotiationParty
  latest_offer: NegotiationOffer | null
  accepted_offer: NegotiationOffer | null
  pending_offer_id: number | null
  unread_count: number
  converted_order_id: number | null
  expires_at: string | null
  last_activity_at: string | null
  closed_at: string | null
  created_at: string | null
}

export interface NegotiationDetail extends Omit<NegotiationSummary, 'latest_offer' | 'pending_offer_id'> {
  offers: NegotiationOffer[]
  pending_offer: NegotiationOffer | null
  messages?: NegotiationMessage[]
  updated_at: string | null
}

export interface NegotiationMessage {
  id: number
  negotiation_id: number
  body: string
  type: 'text' | 'offer' | 'system'
  offer_id: number | null
  client_message_id: string | null
  read_at: string | null
  sender_id: number
  sender?: NegotiationParty
  created_at: string
}

export interface StartNegotiationPayload {
  product_id: number
  product_variant_id?: number | null
  quantity: number
  amount: number
  message?: string | null
}

export interface OfferPayload {
  amount: number
  message?: string | null
}
