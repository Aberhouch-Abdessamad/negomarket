import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { marketplaceService } from '@/features/marketplace/marketplaceService'
import { ApiError } from '@/services/api/types'
import { sellerService } from '../sellerService'
import type { SellerProduct } from '../types'
import ProductFormPage from './ProductFormPage'

vi.mock('../sellerService', () => ({ sellerService: { product: vi.fn(), createProduct: vi.fn(), updateProduct: vi.fn(), publish: vi.fn(), unpublish: vi.fn(), uploadImages: vi.fn() } }))
vi.mock('@/features/marketplace/marketplaceService', () => ({ marketplaceService: { categories: vi.fn() }, wishlistService: {} }))

const saved: SellerProduct = {
  id: 42, name: 'Leather Bag', slug: 'leather-bag', sku: 'BAG-1', description: null, category: { id: 3, name: 'Bags' }, category_id: 3,
  price: 1200, minimum_price: 900, allow_negotiation: true, stock_quantity: 4, status: 'draft', rejection_reason: null, featured: false,
  views_count: 0, sales_count: 0, rating_avg: 0, images: [], variants: [], published_at: null, updated_at: null, created_at: null,
}

function renderAt(url: string) {
  const router = createMemoryRouter([{ path: '/seller/products/new', element: <ProductFormPage /> }, { path: '/seller/products/:id', element: <ProductFormPage /> }], { initialEntries: [url] })
  render(<RouterProvider router={router} />)
  return router
}

describe('ProductFormPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(marketplaceService.categories).mockResolvedValue([{ id: 1, name: 'Fashion', slug: 'fashion', description: null, image_url: null, parent_id: null, children: [{ id: 3, name: 'Bags', slug: 'bags', description: null, image_url: null, parent_id: 1 }] }])
  })

  it('creates a draft with private minimum price and opens the editor', async () => {
    vi.mocked(sellerService.createProduct).mockResolvedValue(saved)
    const router = renderAt('/seller/products/new')

    await userEvent.type(await screen.findByLabelText(/Product name/), 'Leather Bag')
    await userEvent.type(screen.getByLabelText(/^SKU/), 'BAG-1')
    await userEvent.selectOptions(screen.getByLabelText('Category'), '3')
    await userEvent.type(screen.getByLabelText(/Listed price/), '1200')
    await userEvent.click(screen.getByRole('switch', { name: 'Allow price negotiation' }))
    expect(screen.getByText(/never shown to customers/)).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText(/Minimum acceptable price/), '900')
    await userEvent.clear(screen.getByLabelText('Stock quantity'))
    await userEvent.type(screen.getByLabelText('Stock quantity'), '4')
    await userEvent.click(screen.getByRole('button', { name: 'Create draft' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/seller/products/42'))
    expect(sellerService.createProduct).toHaveBeenCalledWith(expect.objectContaining({ minimum_price: 900, allow_negotiation: true, stock_quantity: 4, category_id: 3 }))
  })

  it('blocks a minimum price above the listed price', async () => {
    renderAt('/seller/products/new')
    await userEvent.type(await screen.findByLabelText(/Listed price/), '100')
    await userEvent.click(screen.getByRole('switch', { name: 'Allow price negotiation' }))
    await userEvent.type(screen.getByLabelText(/Minimum acceptable price/), '150')
    await userEvent.click(screen.getByRole('button', { name: 'Create draft' }))
    expect(await screen.findByText('The minimum price must be less than or equal to the listed price.')).toBeInTheDocument()
    expect(sellerService.createProduct).not.toHaveBeenCalled()
  })

  it('shows server errors (e.g. duplicate SKU) and publish feedback for existing products', async () => {
    vi.mocked(sellerService.product).mockResolvedValue(saved)
    vi.mocked(sellerService.updateProduct).mockRejectedValue(new ApiError('invalid', 422, { sku: ['The sku has already been taken.'] }))
    vi.mocked(sellerService.publish).mockRejectedValue(new ApiError('invalid', 422, { images: ['Add at least one product image before publishing.'] }))
    renderAt('/seller/products/42')

    expect(await screen.findByRole('heading', { name: 'Leather Bag' })).toBeInTheDocument()
    expect(screen.getByLabelText(/Minimum acceptable price/)).toHaveValue('900')
    expect(screen.getByLabelText('Category')).toHaveValue('3')
    await userEvent.type(screen.getByLabelText(/^SKU/), 'X')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText('The sku has already been taken.')).toBeInTheDocument()
  })
})
