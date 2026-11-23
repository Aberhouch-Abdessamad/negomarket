export type RoleName = 'customer' | 'seller' | 'admin'

export interface AuthUser {
  id: number
  name: string
  email: string
  phone: string | null
  avatar_url: string | null
  status: 'active' | 'suspended'
  email_verified: boolean
  roles: RoleName[]
  permissions: string[]
  is_admin: boolean
  is_seller: boolean
  store: { id: number; name: string; slug: string; status: string } | null
  seller_application: { id: number; status: 'pending' | 'approved' | 'rejected'; submitted_at: string } | null
  created_at: string
}

export interface LoginPayload {
  email: string
  password: string
  remember?: boolean
}

export interface RegisterPayload {
  name: string
  email: string
  phone?: string
  password: string
  password_confirmation: string
  accept_terms: boolean
}

export interface ResetPasswordPayload {
  token: string
  email: string
  password: string
  password_confirmation: string
}
