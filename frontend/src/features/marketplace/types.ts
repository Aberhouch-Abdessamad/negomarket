export interface Paginated<T> {
  data: T[]
  meta: { current_page: number; last_page: number; per_page: number; total: number; from: number | null; to: number | null }
}

export interface ProductCard {
  id: number
  name: string
  slug: string
  price: number
  price_from: number
  has_variants: boolean
  in_stock: boolean
  allow_negotiation: boolean
  featured: boolean
  rating_avg: number
  rating_count: number
  image_url: string | null
  store?: { name: string; slug: string }
  category?: { name: string; slug: string }
}

export interface StoreProfile {
  id: number
  name: string
  slug: string
  description: string | null
  logo_url: string | null
  banner_url: string | null
  city: string | null
  rating_avg: number
  rating_count: number
  products_count: number
  negotiable_products_count?: number
  member_since: string
}

export interface ProductVariantOption {
  id: number
  sku: string
  attributes: Record<string, string>
  price: number
  stock_quantity: number
  in_stock: boolean
}

export interface ProductDetail {
  id: number
  name: string
  slug: string
  sku: string
  description: string | null
  price: number
  stock_quantity: number
  in_stock: boolean
  allow_negotiation: boolean
  rating_avg: number
  rating_count: number
  sales_count: number
  images: { id: number; url: string; thumbnail_url: string; alt: string }[]
  variants: ProductVariantOption[]
  variant_options: Record<string, string[]>
  category: { name: string; slug: string; parent: { name: string; slug: string } | null }
  store: StoreProfile
  published_at: string | null
}

export interface Category {
  id: number
  name: string
  slug: string
  description: string | null
  image_url: string | null
  parent_id: number | null
  products_count?: number
  children?: Category[]
  parent?: { name: string; slug: string } | null
}

export interface Review {
  id: number
  rating: number
  comment: string | null
  author: string
  verified_purchase: boolean
  seller_reply: string | null
  seller_replied_at: string | null
  created_at: string
}

export interface HomeSections {
  stats: { products: number; stores: number; negotiable_products: number }
  categories: Category[]
  featured: ProductCard[]
  latest: ProductCard[]
  popular: ProductCard[]
  negotiable: ProductCard[]
  stores: StoreProfile[]
}

export type ProductSort = 'newest' | 'price_asc' | 'price_desc' | 'popular' | 'rating'

export interface ProductFilters {
  q?: string
  category?: string
  store?: string
  min_price?: string
  max_price?: string
  negotiable?: string
  min_rating?: string
  in_stock?: string
  sort?: ProductSort
  page?: string
  per_page?: string
}

export interface SearchSuggestions {
  products: ProductCard[]
  stores: { id: number; name: string; slug: string; logo_url: string | null; city: string | null }[]
  categories: { id: number; name: string; slug: string }[]
}
