import { api } from '@/services/api/client'
import type { AuthUser } from '@/features/auth/types'

export interface Address {
  id: number
  label: string | null
  full_name: string
  phone: string
  address_line1: string
  address_line2: string | null
  city: string
  region: string | null
  postal_code: string | null
  country: string
  is_default: boolean
}

export type AddressInput = Omit<Address, 'id' | 'country' | 'is_default' | 'label' | 'address_line2' | 'region' | 'postal_code'> & {
  label?: string
  address_line2?: string
  region?: string
  postal_code?: string
  country?: string
  is_default?: boolean
}

export const accountService = {
  async updateProfile(payload: { name: string; email: string; phone?: string | null }) {
    const res = await api.put<AuthUser>('/profile', payload)
    return { user: res.data, message: res.message ?? 'Profile updated.' }
  },
  async updatePassword(payload: { current_password: string; password: string; password_confirmation: string }) {
    return (await api.put<null>('/profile/password', payload)).message ?? 'Password updated.'
  },
  async uploadAvatar(file: File) {
    const form = new FormData()
    form.append('avatar', file)
    return (await api.upload<AuthUser>('/profile/avatar', form)).data
  },
  async removeAvatar() {
    return (await api.delete<AuthUser>('/profile/avatar')).data
  },
  async addresses() {
    return (await api.get<Address[]>('/profile/addresses')).data
  },
  async createAddress(payload: AddressInput) {
    return (await api.post<Address>('/profile/addresses', payload)).data
  },
  async updateAddress(id: number, payload: AddressInput) {
    return (await api.put<Address>(`/profile/addresses/${id}`, payload)).data
  },
  async setDefaultAddress(id: number) {
    return (await api.patch<Address>(`/profile/addresses/${id}/default`)).data
  },
  async deleteAddress(id: number) {
    await api.delete(`/profile/addresses/${id}`)
  },
}
