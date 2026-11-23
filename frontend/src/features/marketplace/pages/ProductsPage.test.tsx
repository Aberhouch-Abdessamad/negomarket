import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { card } from '@/test/marketplaceFixtures'
import { marketplaceService } from '../marketplaceService'
import ProductsPage from './ProductsPage'

vi.mock('../marketplaceService', () => ({
  marketplaceService: { products: vi.fn(), categories: vi.fn(), category: vi.fn(), product: vi.fn() },
  wishlistService: {},
}))

const meta = (page = 1, last = 3, total = 50) => ({ current_page: page, last_page: last, per_page: 24, total, from: 1, to: 24 })

function renderAt(url: string) {
  const router = createMemoryRouter([{ path: '/products', element: <ProductsPage /> }, { path: '/categories/:slug', element: <ProductsPage /> }], { initialEntries: [url] })
  render(<RouterProvider router={router} />)
  return router
}

describe('ProductsPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(marketplaceService.products).mockResolvedValue({ data: [card(), card({ id: 2, name: 'iPhone 15', slug: 'iphone' })], meta: meta() })
    vi.mocked(marketplaceService.categories).mockResolvedValue([{ id: 1, name: 'Electronics', slug: 'electronics', description: null, image_url: null, parent_id: null, products_count: 8, children: [] }])
    vi.mocked(marketplaceService.category).mockResolvedValue({ id: 5, name: 'Phones', slug: 'phones', description: null, image_url: null, parent_id: 1, parent: { name: 'Electronics', slug: 'electronics' }, children: [] })
  })

  it('reads filters from the URL and renders results with a total', async () => {
    renderAt('/products?q=galaxy&negotiable=1&sort=price_asc&page=2')

    expect(await screen.findByText('iPhone 15')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Results for “galaxy”' })).toBeInTheDocument()
    expect(screen.getByText('50 products')).toBeInTheDocument()
    expect(marketplaceService.products).toHaveBeenCalledWith(expect.objectContaining({ q: 'galaxy', negotiable: '1', sort: 'price_asc', page: '2', per_page: '24' }))
  })

  it('updates the URL on filter/sort changes and resets the page', async () => {
    const router = renderAt('/products?page=2')
    await screen.findByText('iPhone 15')

    await userEvent.selectOptions(screen.getByLabelText('Sort by'), 'price_desc')
    await waitFor(() => expect(router.state.location.search).toBe('?sort=price_desc'))

    await userEvent.click(screen.getAllByLabelText('Negotiation available')[0])
    await waitFor(() => expect(router.state.location.search).toContain('negotiable=1'))

    await userEvent.click(screen.getByRole('button', { name: '3' }))
    await waitFor(() => expect(router.state.location.search).toContain('page=3'))
  })

  it('locks the category on category pages and shows a breadcrumb', async () => {
    renderAt('/categories/phones')
    expect(await screen.findByRole('heading', { name: 'Phones' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Electronics' })).toHaveAttribute('href', '/categories/electronics')
    expect(marketplaceService.products).toHaveBeenCalledWith(expect.objectContaining({ category: 'phones' }))
  })

  it('shows an empty state', async () => {
    vi.mocked(marketplaceService.products).mockResolvedValue({ data: [], meta: meta(1, 1, 0) })
    renderAt('/products?q=zzz')
    expect(await screen.findByText('No products match your filters')).toBeInTheDocument()
  })
})
