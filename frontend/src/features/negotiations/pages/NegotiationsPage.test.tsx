import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/store/authStore'
import { makeSummary } from '@/test/negotiationFixtures'
import { makeUser } from '@/test/fixtures'
import { negotiationService } from '../negotiationService'
import NegotiationsPage from './NegotiationsPage'

vi.mock('../negotiationService', () => ({
  negotiationService: { list: vi.fn() },
}))

const paginated = (items: ReturnType<typeof makeSummary>[]) => ({
  data: items,
  meta: { current_page: 1, last_page: 1, per_page: 15, total: items.length, from: items.length ? 1 : null, to: items.length || null },
})

function renderPage(path = '/negotiations') {
  render(<MemoryRouter initialEntries={[path]}><NegotiationsPage /></MemoryRouter>)
}

describe('NegotiationsPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    useAuthStore.setState({ status: 'authenticated', user: makeUser({ id: 5, name: 'Salma Customer' }) })
    vi.mocked(negotiationService.list).mockResolvedValue(paginated([makeSummary()]))
  })

  it('lists negotiations with latest offer and unread count', async () => {
    renderPage()
    expect(await screen.findByText('Linen Shirt')).toBeInTheDocument()
    expect(screen.getByText('300 MAD')).toBeInTheDocument()
    expect(screen.getByText('2 unread')).toBeInTheDocument()
    expect(screen.getByText('Seller: Atlas Threads')).toBeInTheDocument()
    expect(screen.getByText(/Qty 2/)).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/minimum/i)
  })

  it('offers a seller perspective tab and re-queries with the role filter', async () => {
    useAuthStore.setState({ status: 'authenticated', user: makeUser({ id: 2, name: 'Youssef B', is_seller: true, store: { id: 2, name: 'Atlas', slug: 'atlas', status: 'active' } }) })
    renderPage()
    await screen.findByText('Linen Shirt')

    await userEvent.click(screen.getByRole('tab', { name: 'Selling' }))

    expect(negotiationService.list).toHaveBeenLastCalledWith(expect.objectContaining({ role: 'seller', page: 1 }))
  })

  it('shows an empty state for customers without negotiations', async () => {
    vi.mocked(negotiationService.list).mockResolvedValue(paginated([]))
    renderPage()
    expect(await screen.findByText('No negotiations yet')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Browse negotiable products' })).toBeInTheDocument()
  })

  it('renders the settled price for accepted negotiations', async () => {
    const accepted = makeSummary({
      status: 'accepted',
      status_label: 'Accepted',
      accepted_offer: { ...makeSummary().latest_offer!, id: 11, amount: 310, status: 'accepted', status_label: 'Accepted' },
      pending_offer_id: null,
      unread_count: 0,
    })
    vi.mocked(negotiationService.list).mockResolvedValue(paginated([accepted]))
    renderPage()

    const row = await screen.findByText('Linen Shirt')
    expect(within(row.closest('a')!).getByText('310 MAD')).toBeInTheDocument()
    expect(screen.queryByText('2 unread')).not.toBeInTheDocument()
  })
})
