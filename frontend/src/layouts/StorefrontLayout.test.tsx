import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { marketplaceService } from '@/features/marketplace/marketplaceService'
import { resetCategoriesCache } from '@/hooks/useCategories'
import { useAuthStore } from '@/store/authStore'
import StorefrontLayout from './StorefrontLayout'

vi.mock('@/features/marketplace/marketplaceService', () => ({ marketplaceService: { categories: vi.fn(), search: vi.fn() }, wishlistService: {} }))

const categories = [{ id: 1, name: 'Electronics', slug: 'electronics', description: null, image_url: null, parent_id: null, products_count: 8, children: [{ id: 2, name: 'Cameras', slug: 'cameras', description: null, image_url: null, parent_id: 1, products_count: 1 }] }]

function renderLayout() {
  const router = createMemoryRouter([{ path: '/', element: <StorefrontLayout />, children: [{ index: true, element: <p>child</p> }] }])
  render(<RouterProvider router={router} />)
}

describe('StorefrontLayout', () => {
  beforeEach(() => {
    resetCategoriesCache()
    vi.mocked(marketplaceService.categories).mockResolvedValue(categories)
    useAuthStore.setState({ status: 'guest', user: null })
  })

  it('renders header, content and footer with guest sign-in', async () => {
    renderLayout()
    expect(screen.getByText('child')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Sign in' }).length).toBeGreaterThan(0)
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
    // Category scope in the header search comes from the API.
    expect(await screen.findByRole('option', { name: 'Electronics' })).toBeInTheDocument()
  })

  it('opens the mobile drawer with category accordion and closes it', async () => {
    renderLayout()
    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }))
    const nav = screen.getByRole('navigation', { name: 'Mobile' })
    expect(nav).toBeInTheDocument()

    await userEvent.click(await screen.findByRole('button', { name: 'Electronics' }))
    expect(screen.getByRole('link', { name: 'Cameras' })).toBeInTheDocument()

    await userEvent.click(screen.getAllByRole('button', { name: 'Close menu' })[0])
    expect(screen.queryByRole('navigation', { name: 'Mobile' })).not.toBeInTheDocument()
  })
})
