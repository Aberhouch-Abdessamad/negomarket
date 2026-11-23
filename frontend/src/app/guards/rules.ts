import type { AuthUser } from '@/features/auth/types'

export type Rule = (user: AuthUser) => boolean

export const rules = {
  admin: ((u) => u.is_admin) as Rule,
  approvedSeller: ((u) => u.is_seller) as Rule,
  permission: (name: string): Rule => (u) => u.permissions.includes(name),
}

/** Only allow same-origin relative redirects (prevents open-redirects via ?redirect=). */
export function safeRedirect(value: string | null): string {
  if (!value) return '/'
  const decoded = decodeURIComponent(value)
  return decoded.startsWith('/') && !decoded.startsWith('//') ? decoded : '/'
}
