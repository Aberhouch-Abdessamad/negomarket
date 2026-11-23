import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/services/api/types'
import { useAuthStore } from '@/store/authStore'
import { makeUser } from '@/test/fixtures'
import { authService } from '../authService'
import LoginPage from './LoginPage'

vi.mock('../authService', () => ({ authService: { login: vi.fn(), me: vi.fn(), logout: vi.fn() } }))

function renderAt(url = '/login') {
  const router = createMemoryRouter(
    [
      { path: '/login', element: <LoginPage /> },
      { path: '/', element: <p>home page</p> },
      { path: '/account/addresses', element: <p>addresses page</p> },
    ],
    { initialEntries: [url] },
  )
  render(<RouterProvider router={router} />)
  return router
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    useAuthStore.setState({ status: 'guest', user: null })
  })

  it('validates required fields on the client', async () => {
    renderAt()
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('Email is required.')).toBeInTheDocument()
    expect(screen.getByText('Password is required.')).toBeInTheDocument()
    expect(authService.login).not.toHaveBeenCalled()
  })

  it('shows server-side credential errors on the email field', async () => {
    vi.mocked(authService.login).mockRejectedValue(new ApiError('The given data was invalid.', 422, { email: ['These credentials do not match our records.'] }))
    renderAt()

    await userEvent.type(screen.getByLabelText('Email'), 'salma@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('These credentials do not match our records.')).toBeInTheDocument()
    expect(useAuthStore.getState().status).toBe('guest')
  })

  it('signs in and follows a safe redirect', async () => {
    vi.mocked(authService.login).mockResolvedValue(makeUser())
    const router = renderAt('/login?redirect=%2Faccount%2Faddresses')

    await userEvent.type(screen.getByLabelText('Email'), 'salma@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'secret123')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('addresses page')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/account/addresses')
    expect(useAuthStore.getState().user?.email).toBe('salma@example.com')
    expect(authService.login).toHaveBeenCalledWith({ email: 'salma@example.com', password: 'secret123', remember: false })
  })

  it('fills the form from a development account', async () => {
    renderAt()

    await userEvent.click(screen.getByRole('button', { name: 'Use Admin account' }))

    expect(screen.getByLabelText('Email')).toHaveValue('admin@negomarket.test')
    expect(screen.getByLabelText('Password')).toHaveValue('password')
    expect(screen.getByRole('status')).toHaveTextContent('Admin account filled in')
  })

  it('ignores external redirect targets', async () => {
    vi.mocked(authService.login).mockResolvedValue(makeUser())
    renderAt('/login?redirect=%2F%2Fevil.example.com')

    await userEvent.type(screen.getByLabelText('Email'), 'salma@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'secret123')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('home page')).toBeInTheDocument()
  })
})
