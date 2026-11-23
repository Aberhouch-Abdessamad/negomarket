import { api } from '@/services/api/client'
import type { Category, HomeSections, Paginated, ProductCard, ProductDetail, ProductFilters, Review, SearchSuggestions, StoreProfile } from './types'

const clean = (params: object) => Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''))

async function paginated<T>(url: string, params: object): Promise<Paginated<T>> {
  const res = await api.get<T[]>(url, clean(params))
  return { data: res.data, meta: res.meta as Paginated<T>['meta'] }
}

export const marketplaceService = {
  async home(): Promise<HomeSections> {
    return (await api.get<HomeSections>('/home')).data
  },
  products(filters: ProductFilters): Promise<Paginated<ProductCard>> {
    return paginated<ProductCard>('/products', filters)
  },
  async product(slug: string): Promise<{ product: ProductDetail; ratingBreakdown: Record<string, number> }> {
    const res = await api.get<ProductDetail>(`/products/${encodeURIComponent(slug)}`)
    return { product: res.data, ratingBreakdown: (res.meta?.rating_breakdown ?? {}) as Record<string, number> }
  },
  async related(slug: string): Promise<ProductCard[]> {
    return (await api.get<ProductCard[]>(`/products/${encodeURIComponent(slug)}/related`)).data
  },
  reviews(productId: number, page = 1): Promise<Paginated<Review>> {
    return paginated<Review>(`/products/${productId}/reviews`, { page })
  },
  async categories(): Promise<Category[]> {
    return (await api.get<Category[]>('/categories')).data
  },
  async category(slug: string): Promise<Category> {
    return (await api.get<Category>(`/categories/${encodeURIComponent(slug)}`)).data
  },
  async stores(params: { q?: string; city?: string; sort?: string; page?: number }): Promise<Paginated<StoreProfile> & { cities: string[] }> {
    const res = await api.get<StoreProfile[]>('/stores', clean(params))
    return { data: res.data, meta: res.meta as Paginated<StoreProfile>['meta'], cities: (res.meta?.cities ?? []) as string[] }
  },
  async store(slug: string): Promise<StoreProfile> {
    return (await api.get<StoreProfile>(`/stores/${encodeURIComponent(slug)}`)).data
  },
  async search(q: string): Promise<SearchSuggestions> {
    return (await api.get<SearchSuggestions>('/search', { q })).data
  },
}

export const wishlistService = {
  async ids(): Promise<number[]> {
    return (await api.get<number[]>('/wishlist/ids')).data
  },
  list(page = 1): Promise<Paginated<ProductCard>> {
    return paginated<ProductCard>('/wishlist', { page })
  },
  async add(productId: number) {
    await api.post(`/wishlist/${productId}`)
  },
  async remove(productId: number) {
    await api.delete(`/wishlist/${productId}`)
  },
}
