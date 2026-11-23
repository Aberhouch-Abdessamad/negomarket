import type { ProductCard, ProductDetail, StoreProfile } from '@/features/marketplace/types'

export const store: StoreProfile = {
  id: 1, name: 'Atlas Electronics', slug: 'atlas', description: 'Phones and laptops', logo_url: null, banner_url: null,
  city: 'Casablanca', rating_avg: 4.5, rating_count: 12, products_count: 8, negotiable_products_count: 3, member_since: '2026-10-01',
}

export function card(overrides: Partial<ProductCard> = {}): ProductCard {
  return {
    id: 1, name: 'Galaxy A55', slug: 'galaxy-a55', price: 3899, price_from: 3899, has_variants: false, in_stock: true,
    allow_negotiation: true, featured: false, rating_avg: 4, rating_count: 3, image_url: '/img.webp',
    store: { name: store.name, slug: store.slug }, category: { name: 'Phones', slug: 'phones' }, ...overrides,
  }
}

export function detail(overrides: Partial<ProductDetail> = {}): ProductDetail {
  return {
    id: 9, name: 'Linen Shirt', slug: 'linen-shirt', sku: 'CAS-0001', description: 'Light linen.', price: 349, stock_quantity: 4,
    in_stock: true, allow_negotiation: true, rating_avg: 0, rating_count: 0, sales_count: 0,
    images: [{ id: 1, url: '/a.webp', thumbnail_url: '/a-t.webp', alt: 'Linen Shirt' }],
    variants: [
      { id: 1, sku: 'CAS-0001-1', attributes: { color: 'Black', size: 'M' }, price: 349, stock_quantity: 3, in_stock: true },
      { id: 2, sku: 'CAS-0001-2', attributes: { color: 'Sand', size: 'M' }, price: 379, stock_quantity: 0, in_stock: false },
      { id: 3, sku: 'CAS-0001-3', attributes: { color: 'Sand', size: 'L' }, price: 379, stock_quantity: 1, in_stock: true },
    ],
    variant_options: { color: ['Black', 'Sand'], size: ['M', 'L'] },
    category: { name: 'Men', slug: 'men', parent: { name: 'Fashion', slug: 'fashion' } },
    store, published_at: '2026-10-01T00:00:00Z', ...overrides,
  }
}
