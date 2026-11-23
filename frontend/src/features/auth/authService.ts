import { api, ensureCsrfCookie } from '@/services/api/client'
import type { AuthUser, LoginPayload, RegisterPayload, ResetPasswordPayload } from './types'

export const authService = {
  async me(): Promise<AuthUser> {
    return (await api.get<AuthUser>('/auth/me')).data
  },

  async login(payload: LoginPayload): Promise<AuthUser> {
    await ensureCsrfCookie()
    return (await api.post<AuthUser>('/auth/login', payload)).data
  },

  async register(payload: RegisterPayload): Promise<{ user: AuthUser; message: string }> {
    await ensureCsrfCookie()
    const res = await api.post<AuthUser>('/auth/register', payload)
    return { user: res.data, message: res.message ?? '' }
  },

  async logout(): Promise<void> {
    await api.post('/auth/logout')
  },

  async forgotPassword(email: string): Promise<string> {
    await ensureCsrfCookie()
    return (await api.post<null>('/auth/forgot-password', { email })).message ?? ''
  },

  async resetPassword(payload: ResetPasswordPayload): Promise<string> {
    await ensureCsrfCookie()
    return (await api.post<null>('/auth/reset-password', payload)).message ?? ''
  },
}
