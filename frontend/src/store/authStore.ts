import { create } from 'zustand'
import { authService } from '@/features/auth/authService'
import type { AuthUser, LoginPayload, RegisterPayload } from '@/features/auth/types'
import { setUnauthorizedHandler } from '@/services/api/client'
import { disconnectEcho } from '@/services/realtime/echo'

export type AuthStatus = 'unknown' | 'authenticated' | 'guest'

interface AuthState {
  status: AuthStatus
  user: AuthUser | null
  /** Loads the current session once at start-up (GET /auth/me). */
  bootstrap: () => Promise<void>
  refresh: () => Promise<void>
  login: (payload: LoginPayload) => Promise<AuthUser>
  register: (payload: RegisterPayload) => Promise<{ user: AuthUser; message: string }>
  logout: () => Promise<void>
  setUser: (user: AuthUser) => void
  clear: () => void
}

let bootstrapping: Promise<void> | null = null

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'unknown',
  user: null,

  bootstrap: () => {
    if (get().status !== 'unknown') return Promise.resolve()
    bootstrapping ??= authService
      .me()
      .then((user) => set({ user, status: 'authenticated' }))
      .catch(() => set({ user: null, status: 'guest' }))
      .finally(() => {
        bootstrapping = null
      })
    return bootstrapping
  },

  refresh: async () => {
    try {
      set({ user: await authService.me(), status: 'authenticated' })
    } catch {
      get().clear()
    }
  },

  login: async (payload) => {
    const user = await authService.login(payload)
    set({ user, status: 'authenticated' })
    return user
  },

  register: async (payload) => {
    const result = await authService.register(payload)
    set({ user: result.user, status: 'authenticated' })
    return result
  },

  logout: async () => {
    try {
      await authService.logout()
    } finally {
      get().clear()
    }
  },

  setUser: (user) => set({ user, status: 'authenticated' }),

  clear: () => {
    disconnectEcho()
    set({ user: null, status: 'guest' })
  },
}))

// Any 401 from the API means the session is gone (expired, logged out elsewhere, suspended).
setUnauthorizedHandler(() => {
  if (useAuthStore.getState().status === 'authenticated') useAuthStore.getState().clear()
})

/** Selector helpers */
export const selectIsAdmin = (s: AuthState) => Boolean(s.user?.is_admin)
export const selectIsSeller = (s: AuthState) => Boolean(s.user?.is_seller)
