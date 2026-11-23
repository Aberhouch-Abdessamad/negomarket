import type { NegotiationDetail, NegotiationOffer, NegotiationSummary } from '@/features/negotiations/types'

const baseOffer: NegotiationOffer = {
  id: 10,
  negotiation_id: 1,
  amount: 300,
  status: 'pending',
  status_label: 'Pending',
  sender_role: 'customer',
  sender_id: 5,
  sender: { id: 5, name: 'Salma Customer', avatar_url: null },
  parent_offer_id: null,
  message: 'Would you take 300?',
  expires_at: new Date(Date.now() + 48 * 3_600_000).toISOString(),
  is_expired: false,
  responded_at: null,
  responded_by: null,
  created_at: new Date(Date.now() - 3_600_000).toISOString(),
}

export function makeOffer(overrides: Partial<NegotiationOffer> = {}): NegotiationOffer {
  return { ...baseOffer, ...overrides }
}

export function makeSummary(overrides: Partial<NegotiationSummary> = {}): NegotiationSummary {
  return {
    id: 1,
    status: 'active',
    status_label: 'Active',
    role: 'customer',
    quantity: 2,
    product: { id: 7, name: 'Linen Shirt', slug: 'linen-shirt', price: 349, image_url: null },
    variant: { id: 3, sku: 'CAS-0001-3', attributes: { Color: 'Sand', Size: 'L' }, price: 379 },
    store: { id: 2, name: 'Atlas Threads', slug: 'atlas-threads', logo_url: null },
    customer: { id: 5, name: 'Salma Customer', avatar_url: null },
    latest_offer: baseOffer,
    accepted_offer: null,
    pending_offer_id: 10,
    unread_count: 2,
    converted_order_id: null,
    expires_at: new Date(Date.now() + 48 * 3_600_000).toISOString(),
    last_activity_at: new Date(Date.now() - 60_000).toISOString(),
    closed_at: null,
    created_at: new Date(Date.now() - 7_200_000).toISOString(),
    ...overrides,
  }
}

export function makeDetail(overrides: Partial<NegotiationDetail> = {}): NegotiationDetail {
  return {
    id: 1,
    status: 'active',
    status_label: 'Active',
    role: 'customer',
    quantity: 2,
    product: {
      id: 7,
      name: 'Linen Shirt',
      slug: 'linen-shirt',
      sku: 'CAS-0001',
      price: 349,
      allow_negotiation: true,
      stock_quantity: 8,
      status: 'published',
      image_url: null,
      thumbnail_url: null,
    },
    variant: { id: 3, sku: 'CAS-0001-3', attributes: { Color: 'Sand', Size: 'L' }, price: 379, stock_quantity: 4, status: 'active' },
    store: { id: 2, name: 'Atlas Threads', slug: 'atlas-threads', logo_url: null },
    customer: { id: 5, name: 'Salma Customer', avatar_url: null },
    offers: [baseOffer],
    pending_offer: baseOffer,
    messages: [],
    accepted_offer: null,
    unread_count: 0,
    converted_order_id: null,
    expires_at: new Date(Date.now() + 48 * 3_600_000).toISOString(),
    last_activity_at: new Date(Date.now() - 60_000).toISOString(),
    closed_at: null,
    created_at: new Date(Date.now() - 7_200_000).toISOString(),
    updated_at: new Date(Date.now() - 60_000).toISOString(),
    ...overrides,
  }
}
