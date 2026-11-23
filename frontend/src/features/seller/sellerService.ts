import { api } from '@/services/api/client'
import type { Paginated } from '@/features/marketplace/types'
import type {
  InventoryMovement, InventoryRow, ProductPayload, SellerAnalytics, SellerDashboard, SellerProduct,
  SellerReview, SellerStore, StoreAddress, StoreApplication,
} from './types'

const clean = (o: object) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== ''))

async function page<T>(url: string, params: object = {}): Promise<Paginated<T>> {
  const res = await api.get<T[]>(url, clean(params))
  return { data: res.data, meta: res.meta as Paginated<T>['meta'] }
}

export const sellerService = {
  // Onboarding
  async application() {
    return (await api.get<StoreApplication | null>('/seller/application')).data
  },
  async apply(payload: Omit<StoreApplication, 'id' | 'status' | 'admin_notes' | 'reviewed_at' | 'created_at'> & { accept_seller_terms: boolean }) {
    return (await api.post<StoreApplication>('/seller/applications', payload)).data
  },

  // Dashboard
  async dashboard() {
    return (await api.get<SellerDashboard>('/seller/dashboard')).data
  },
  async analytics(period: 7 | 30 | 90) {
    return (await api.get<SellerAnalytics>('/seller/analytics', { period })).data
  },

  // Store
  async store() {
    return (await api.get<SellerStore>('/seller/store')).data
  },
  async updateStore(payload: Partial<SellerStore>) {
    return (await api.put<SellerStore>('/seller/store', payload)).data
  },
  async uploadStoreImage(kind: 'logo' | 'banner', file: File) {
    const form = new FormData()
    form.append('image', file)
    return (await api.upload<SellerStore>(`/seller/store/${kind}`, form)).data
  },
  async saveAddress(payload: Partial<StoreAddress>, id?: number) {
    return id ? (await api.put<StoreAddress>(`/seller/store/addresses/${id}`, payload)).data : (await api.post<StoreAddress>('/seller/store/addresses', payload)).data
  },
  async deleteAddress(id: number) {
    await api.delete(`/seller/store/addresses/${id}`)
  },

  // Products
  products(params: { q?: string; status?: string; stock?: string; sort?: string; page?: number }) {
    return page<SellerProduct>('/seller/products', params)
  },
  async product(id: number) {
    return (await api.get<SellerProduct>(`/seller/products/${id}`)).data
  },
  async createProduct(payload: ProductPayload) {
    return (await api.post<SellerProduct>('/seller/products', payload)).data
  },
  async updateProduct(id: number, payload: ProductPayload) {
    return (await api.put<SellerProduct>(`/seller/products/${id}`, payload)).data
  },
  async publish(id: number) {
    const res = await api.post<SellerProduct>(`/seller/products/${id}/publish`)
    return { product: res.data, message: res.message ?? '' }
  },
  async unpublish(id: number) {
    return (await api.post<SellerProduct>(`/seller/products/${id}/unpublish`)).data
  },
  async deleteProduct(id: number) {
    const res = await api.delete<{ result: 'archived' | 'deleted' }>(`/seller/products/${id}`)
    return res.message ?? ''
  },
  async uploadImages(id: number, files: File[]) {
    const form = new FormData()
    files.forEach((f) => form.append('images[]', f))
    return (await api.upload<SellerProduct>(`/seller/products/${id}/images`, form)).data
  },
  async reorderImages(id: number, imageIds: number[]) {
    return (await api.patch<SellerProduct>(`/seller/products/${id}/images/order`, { image_ids: imageIds })).data
  },
  async deleteImage(id: number, imageId: number) {
    return (await api.delete<SellerProduct>(`/seller/products/${id}/images/${imageId}`)).data
  },

  // Inventory
  async inventory(params: { q?: string; stock?: string; page?: number }) {
    const res = await api.get<InventoryRow[]>('/seller/inventory', clean(params))
    return { data: res.data, meta: res.meta as Paginated<InventoryRow>['meta'] & { low_stock_threshold: number } }
  },
  async adjustStock(payload: { product_id: number; product_variant_id?: number | null; mode: 'set' | 'add' | 'remove'; quantity: number; note?: string }) {
    return (await api.post<InventoryMovement | null>('/seller/inventory/adjust', payload)).message ?? ''
  },
  movements(params: { product_id?: number; type?: string; page?: number }) {
    return page<InventoryMovement>('/seller/inventory/movements', params)
  },

  // Reviews
  reviews(params: { rating?: number; replied?: 'yes' | 'no'; page?: number }) {
    return page<SellerReview>('/seller/reviews', params)
  },
  async replyToReview(id: number, reply: string) {
    return (await api.post<SellerReview>(`/seller/reviews/${id}/reply`, { reply })).data
  },
}
