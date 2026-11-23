import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/services/api/types'
import { useAuthStore } from '@/store/authStore'
import { makeUser } from '@/test/fixtures'
import { authService } from '../authService'
import RegisterPage from './RegisterPage'

vi.mock('../authService', () => ({ authService: { register: vi.fn(), me: vi.fn(), logout: vi.fn() } }))

function renderPage() {
  const router = createMemoryRouter([{ path: '/register', element: <RegisterPage /> }, { path: '/', element: <p>home page</p> }], { initialEntries: ['/register'] })
  render(<RouterProvider router={router} />)
}

async function fill(overrides: Partial<Record<string, string>> = {}) {
  const v = { name: 'Salma B', email: 'salma@example.com', password: 'secret123', confirm: 'secret123', ...overrides }
  await userEvent.type(screen.getByLabelText(/Full name/), v.name)
  await userEvent.type(screen.getByLabelText(/^Email/), v.email)
  await userEvent.type(screen.getByLabelText(/^Password/), v.password)
  await userEvent.type(screen.getByLabelText(/Confirm password/), v.confirm)
}

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    useAuthStore.setState({ status: 'guest', user: null })
  })

  it('requires terms and matching passwords', async () => {
    renderPage()
    await fill({ confirm: 'different1' })
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByText('Passwords do not match.')).toBeInTheDocument()
    expect(screen.getByText('You must accept the terms to continue.')).toBeInTheDocument()
    expect(authService.register).not.toHaveBeenCalled()
  })

  it('maps server validation errors (e.g. taken email)', async () => {
    vi.mocked(authService.register).mockRejectedValue(new ApiError('invalid', 422, { email: ['The email has already been taken.'] }))
    renderPage()
    await fill()
    await userEvent.click(screen.getByRole('checkbox'))
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByText('The email has already been taken.')).toBeInTheDocument()
  })

  it('creates the account and signs the user in', async () => {
    vi.mocked(authService.register).mockResolvedValue({ user: makeUser({ email_verified: true }), message: 'Account created.' })
    renderPage()
    await fill()
    await userEvent.click(screen.getByRole('checkbox'))
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByText('home page')).toBeInTheDocument()
    expect(useAuthStore.getState().status).toBe('authenticated')
    expect(vi.mocked(authService.register).mock.calls[0][0]).toMatchObject({ accept_terms: true, phone: undefined })
  })
})
