import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/store/authStore'
import { makeUser } from '@/test/fixtures'
import { sellerService } from '../sellerService'
import SellerDashboardPage from './SellerDashboardPage'

vi.mock('../sellerService', () => ({ sellerService: { dashboard: vi.fn() } }))

describe('SellerDashboardPage', () => {
  it('renders KPIs and stock alerts from the API', async () => {
    useAuthStore.setState({ status: 'authenticated', user: makeUser({ name: 'Youssef B', is_seller: true, store: { id: 1, name: 'Atlas', slug: 'atlas', status: 'active' } }) })
    vi.mocked(sellerService.dashboard).mockResolvedValue({
      kpis: { revenue_30d: 12500, orders_30d: 7, pending_orders: 2, cod_to_collect: 300, cod_collected_30d: 900, active_negotiations: 3, offers_awaiting_reply: 1, product_views: 1234, rating_avg: 4.6, rating_count: 9 },
      products: { by_status: { draft: 1, pending_review: 2, published: 10, rejected: 0, archived: 0 }, low_stock: 1, out_of_stock: 1 },
      orders_by_status: {},
      low_stock_products: [{ id: 5, name: 'Canon R50', sku: 'ATL-8', stock_quantity: 0, status: 'published' }],
      recent_orders: [],
      sales_last_30_days: [{ date: '2026-11-21', orders: 1, revenue: 500 }],
    })
    render(<MemoryRouter><SellerDashboardPage /></MemoryRouter>)

    expect(await screen.findByText('12,500 MAD')).toBeInTheDocument()
    expect(screen.getByText('Welcome back, Youssef')).toBeInTheDocument()
    expect(screen.getByText('3 offers awaiting your reply'.replace('3', '1'))).toBeInTheDocument()
    expect(screen.getByText('Canon R50')).toBeInTheDocument()
    expect(screen.getByText('Out of stock')).toBeInTheDocument()
    expect(screen.getByText(/No orders yet/)).toBeInTheDocument()
  })
})
