import type { AuthUser } from '@/features/auth/types'

export function makeUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 1,
    name: 'Salma Customer',
    email: 'salma@example.com',
    phone: '0612345678',
    avatar_url: null,
    status: 'active',
    email_verified: true,
    roles: ['customer'],
    permissions: ['negotiations.create', 'orders.create'],
    is_admin: false,
    is_seller: false,
    store: null,
    seller_application: null,
    created_at: '2026-11-22T10:00:00+00:00',
    ...overrides,
  }
}
