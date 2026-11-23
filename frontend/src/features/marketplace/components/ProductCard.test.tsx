import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/store/authStore'
import { useWishlistStore } from '@/store/wishlistStore'
import { makeUser } from '@/test/fixtures'
import { card } from '@/test/marketplaceFixtures'
import { wishlistService } from '../marketplaceService'
import { ProductCard } from './ProductCard'

vi.mock('../marketplaceService', () => ({ wishlistService: { add: vi.fn(), remove: vi.fn(), ids: vi.fn() }, marketplaceService: {} }))

function renderCard(props = card()) {
  const router = createMemoryRouter([{ path: '/', element: <ProductCard product={props} /> }, { path: '/login', element: <p>login</p> }])
  render(<RouterProvider router={router} />)
  return router
}

describe('ProductCard', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    useWishlistStore.setState({ ids: new Set(), loaded: true })
  })

  it('shows price, store, rating and negotiation badge', () => {
    renderCard()
    expect(screen.getByText('3,899 MAD')).toBeInTheDocument()
    expect(screen.getByText('Atlas Electronics')).toBeInTheDocument()
    expect(screen.getByText('Negotiable')).toBeInTheDocument()
    expect(screen.getByLabelText(/Rated 4.0 out of 5/)).toBeInTheDocument()
  })

  it('shows "from" pricing for variant products and out-of-stock state', () => {
    renderCard(card({ has_variants: true, price_from: 2999, in_stock: false, allow_negotiation: false }))
    expect(screen.getByText('From')).toBeInTheDocument()
    expect(screen.getByText('2,999 MAD')).toBeInTheDocument()
    expect(screen.getByText('Out of stock')).toBeInTheDocument()
    expect(screen.queryByText('Negotiable')).not.toBeInTheDocument()
  })

  it('sends guests to login when saving to wishlist', async () => {
    useAuthStore.setState({ status: 'guest', user: null })
    const router = renderCard()
    await userEvent.click(screen.getByRole('button', { name: 'Save to wishlist' }))
    expect(router.state.location.pathname).toBe('/login')
  })

  it('toggles the wishlist optimistically for signed-in users', async () => {
    useAuthStore.setState({ status: 'authenticated', user: makeUser() })
    vi.mocked(wishlistService.add).mockResolvedValue()
    renderCard()
    await userEvent.click(screen.getByRole('button', { name: 'Save to wishlist' }))
    expect(screen.getByRole('button', { name: 'Remove from wishlist' })).toHaveAttribute('aria-pressed', 'true')
    expect(wishlistService.add).toHaveBeenCalledWith(1)
  })

  it('rolls back the heart when the API fails', async () => {
    useAuthStore.setState({ status: 'authenticated', user: makeUser() })
    vi.mocked(wishlistService.add).mockRejectedValue(new Error('boom'))
    renderCard()
    await userEvent.click(screen.getByRole('button', { name: 'Save to wishlist' }))
    expect(await screen.findByRole('button', { name: 'Save to wishlist' })).toHaveAttribute('aria-pressed', 'false')
  })
})
