import { beforeEach, describe, expect, it, vi } from 'vitest'
import { authService } from '@/features/auth/authService'
import { ApiError } from '@/services/api/types'
import { makeUser } from '@/test/fixtures'
import { useAuthStore } from './authStore'

vi.mock('@/features/auth/authService', () => ({ authService: { me: vi.fn(), login: vi.fn(), logout: vi.fn(), register: vi.fn() } }))

describe('authStore', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    useAuthStore.setState({ status: 'unknown', user: null })
  })

  it('bootstraps as guest when /auth/me returns 401', async () => {
    vi.mocked(authService.me).mockRejectedValue(new ApiError('Unauthenticated.', 401))
    await useAuthStore.getState().bootstrap()
    expect(useAuthStore.getState().status).toBe('guest')
  })

  it('bootstraps the current user once even if called twice', async () => {
    vi.mocked(authService.me).mockResolvedValue(makeUser())
    await Promise.all([useAuthStore.getState().bootstrap(), useAuthStore.getState().bootstrap()])
    expect(authService.me).toHaveBeenCalledTimes(1)
    expect(useAuthStore.getState().user?.name).toBe('Salma Customer')
  })

  it('clears the session on logout even if the request fails', async () => {
    useAuthStore.setState({ status: 'authenticated', user: makeUser() })
    vi.mocked(authService.logout).mockRejectedValue(new ApiError('Server error.', 500))
    await expect(useAuthStore.getState().logout()).rejects.toThrow()
    expect(useAuthStore.getState().status).toBe('guest')
    expect(useAuthStore.getState().user).toBeNull()
  })
})
