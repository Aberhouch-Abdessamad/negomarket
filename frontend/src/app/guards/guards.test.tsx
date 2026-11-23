import { render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import { useAuthStore } from '@/store/authStore'
import { makeUser } from '@/test/fixtures'
import { RequireAuth, RequireGuest, RequireRole } from '.'
import { rules, safeRedirect } from './rules'

function renderAt(url: string) {
  const router = createMemoryRouter(
    [
      { path: '/login', element: <RequireGuest><p>login page</p></RequireGuest> },
      { path: '/account', element: <RequireAuth><p>account page</p></RequireAuth> },
      { path: '/admin', element: <RequireRole rule={rules.admin}><p>admin page</p></RequireRole> },
      { path: '/seller', element: <RequireRole rule={rules.approvedSeller}><p>seller page</p></RequireRole> },
      { path: '/', element: <p>home page</p> },
    ],
    { initialEntries: [url] },
  )
  render(<RouterProvider router={router} />)
  return router
}

describe('route guards', () => {
  beforeEach(() => useAuthStore.setState({ status: 'guest', user: null }))

  it('shows a spinner while the session is unknown', () => {
    useAuthStore.setState({ status: 'unknown' })
    renderAt('/account')
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('redirects guests to login with a return path', () => {
    const router = renderAt('/account')
    expect(screen.getByText('login page')).toBeInTheDocument()
    expect(router.state.location.search).toBe('?redirect=%2Faccount')
  })

  it('redirects signed-in users away from guest pages', () => {
    useAuthStore.setState({ status: 'authenticated', user: makeUser() })
    renderAt('/login')
    expect(screen.getByText('home page')).toBeInTheDocument()
  })

  it('enforces roles', () => {
    useAuthStore.setState({ status: 'authenticated', user: makeUser() })
    renderAt('/admin')
    expect(screen.getByText('Access denied')).toBeInTheDocument()
  })

  it('allows admins and approved sellers into their areas', () => {
    useAuthStore.setState({ status: 'authenticated', user: makeUser({ is_admin: true, roles: ['admin', 'customer'] }) })
    renderAt('/admin')
    expect(screen.getByText('admin page')).toBeInTheDocument()
  })

  it('denies sellers without an approved store', () => {
    useAuthStore.setState({ status: 'authenticated', user: makeUser({ roles: ['customer', 'seller'], is_seller: false }) })
    renderAt('/seller')
    expect(screen.getByText('Access denied')).toBeInTheDocument()
  })

  it('only accepts relative redirects', () => {
    expect(safeRedirect('%2Faccount')).toBe('/account')
    expect(safeRedirect('//evil.com')).toBe('/')
    expect(safeRedirect('https://evil.com')).toBe('/')
    expect(safeRedirect(null)).toBe('/')
  })
})
