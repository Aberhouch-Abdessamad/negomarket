import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { marketplaceService } from '@/features/marketplace/marketplaceService'
import type { AuthUser } from '@/features/auth/types'
import { ApiError } from '@/services/api/types'
import { useAuthStore } from '@/store/authStore'
import { detail } from '@/test/marketplaceFixtures'
import ProductDetailPage from './ProductDetailPage'

vi.mock('@/features/marketplace/marketplaceService', () => ({
  marketplaceService: { product: vi.fn(), related: vi.fn(), reviews: vi.fn() },
  wishlistService: {},
}))

function renderPage() {
  const router = createMemoryRouter([{ path: '/products/:slug', element: <ProductDetailPage /> }], { initialEntries: ['/products/linen-shirt'] })
  render(<RouterProvider router={router} />)
}

describe('ProductDetailPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    useAuthStore.getState().clear()
    vi.mocked(marketplaceService.product).mockResolvedValue({ product: detail(), ratingBreakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } })
    vi.mocked(marketplaceService.related).mockResolvedValue([])
    vi.mocked(marketplaceService.reviews).mockResolvedValue({ data: [], meta: { current_page: 1, last_page: 1, per_page: 10, total: 0, from: null, to: null } })
  })

  it('renders product information without exposing private data', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Linen Shirt' })).toBeInTheDocument()
    expect(screen.getByText('349 MAD')).toBeInTheDocument()
    expect(screen.getByText(/Seller accepts offers/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Fashion' })).toBeInTheDocument()
    expect(await screen.findByText(/No reviews yet/)).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/minimum/i)
  })

  it('updates price, SKU and stock when a variant is selected', async () => {
    renderPage()
    await screen.findByRole('heading', { name: 'Linen Shirt' })

    await userEvent.click(screen.getByRole('button', { name: 'Sand' }))
    await userEvent.click(screen.getByRole('button', { name: 'L' }))

    expect(screen.getByText('379 MAD')).toBeInTheDocument()
    expect(screen.getByText('SKU CAS-0001-3')).toBeInTheDocument()
    expect(screen.getByText(/only 1 left/)).toBeInTheDocument()
  })

  it('marks out-of-stock combinations', async () => {
    renderPage()
    await screen.findByRole('heading', { name: 'Linen Shirt' })
    await userEvent.click(screen.getByRole('button', { name: 'Sand' }))
    await userEvent.click(screen.getByRole('button', { name: 'M' }))
    expect(screen.getByText('Out of stock')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'M' })).toHaveClass('line-through')
  })

  it('auto-selects the only variant so the buy actions work immediately', async () => {
    vi.mocked(marketplaceService.product).mockResolvedValue({
      product: detail({
        variants: [{ id: 7, sku: 'CAS-0007', attributes: { color: 'Black' }, price: 359, stock_quantity: 5, in_stock: true }],
        variant_options: { color: ['Black'] },
      }),
      ratingBreakdown: {},
    })

    renderPage()
    await screen.findByRole('heading', { name: 'Linen Shirt' })

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Buy Now' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Add to cart' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Make an Offer' })).toBeEnabled()
    expect(screen.getByText('359 MAD')).toBeInTheDocument()
    expect(screen.getByText('SKU CAS-0007')).toBeInTheDocument()
  })

  it('explains why the buy actions are disabled until every option is chosen', async () => {
    renderPage()
    await screen.findByRole('heading', { name: 'Linen Shirt' })

    const buyNow = screen.getByRole('button', { name: 'Buy Now' })
    expect(buyNow).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent('Choose color and size above')

    await userEvent.click(screen.getByRole('button', { name: 'Black' }))
    await userEvent.click(screen.getByRole('button', { name: 'M' }))

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(buyNow).toBeEnabled()
  })

  it('blocks the buy actions on a seller’s own listing and says why', async () => {
    useAuthStore.setState({
      status: 'authenticated',
      user: {
        id: 5, name: 'Salma Customer', email: 'customer@negomarket.test', phone: null, avatar_url: null,
        status: 'active', email_verified: true, roles: ['customer', 'seller'], permissions: [],
        is_admin: false, is_seller: true, store: { id: 1, name: 'Atlas Electronics', slug: 'atlas', status: 'active' },
        seller_application: null, created_at: '2026-01-01T00:00:00Z',
      } satisfies AuthUser,
    })

    renderPage()
    await screen.findByRole('heading', { name: 'Linen Shirt' })

    expect(screen.getByText(/This is your own listing/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Buy Now' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Add to cart' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Make an Offer' })).toBeDisabled()
  })

  it('shows the uploaded photo at a capped size instead of filling the viewport', async () => {
    renderPage()
    await screen.findByRole('heading', { name: 'Linen Shirt' })

    const image = screen.getByAltText('Linen Shirt')
    // The whole photo is fitted inside the box (no zoom/crop) and the box is width-capped.
    expect(image).toHaveClass('object-contain')
    expect(image.parentElement?.className).toMatch(/max-w-\[22rem\]/)
  })

  it('shows a 404 page for unknown products', async () => {
    vi.mocked(marketplaceService.product).mockRejectedValue(new ApiError('Resource not found.', 404))
    renderPage()
    expect(await screen.findByText('Page not found')).toBeInTheDocument()
  })
})
