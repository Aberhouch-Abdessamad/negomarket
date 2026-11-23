import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { FullPageSpinner } from '@/components/ui'
import ForbiddenPage from '@/pages/ForbiddenPage'
import { useAuthStore } from '@/store/authStore'
import { type Rule, safeRedirect } from './rules'

/** Only for signed-in users; guests are sent to /login?redirect=<current path>. */
export function RequireAuth({ children }: { children?: ReactNode }) {
  const status = useAuthStore((s) => s.status)
  const location = useLocation()

  if (status === 'unknown') return <FullPageSpinner />
  if (status === 'guest') {
    const redirect = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?redirect=${redirect}`} replace />
  }
  return children ?? <Outlet />
}

/** Only for guests (login/register); signed-in users go to ?redirect or home. */
export function RequireGuest({ children }: { children?: ReactNode }) {
  const status = useAuthStore((s) => s.status)
  const location = useLocation()

  if (status === 'unknown') return <FullPageSpinner />
  if (status === 'authenticated') {
    return <Navigate to={safeRedirect(new URLSearchParams(location.search).get('redirect'))} replace />
  }
  return children ?? <Outlet />
}

/**
 * Hides UI the user may not use. This is a UX convenience only: the API
 * enforces the same roles/permissions on every request.
 */
export function RequireRole({ rule, children }: { rule: Rule; children?: ReactNode }) {
  const user = useAuthStore((s) => s.user)
  const status = useAuthStore((s) => s.status)

  if (status === 'unknown') return <FullPageSpinner />
  if (!user) return <RequireAuth />
  if (!rule(user)) return <ForbiddenPage />
  return children ?? <Outlet />
}
