import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/services/api/types'
import { adminService } from '../adminService'
import ProductModerationPage from './ProductModerationPage'

vi.mock('../adminService', () => ({
  adminService: {
    moderationQueue: vi.fn(),
    approveProduct: vi.fn(),
    rejectProduct: vi.fn(),
  },
}))

const meta = { current_page: 1, last_page: 1, per_page: 20, total: 1, from: 1, to: 1 }
const product = {
  id: 12,
  name: 'Atlas Tent',
  slug: 'atlas-tent',
  sku: 'TENT-1',
  description: 'Four-season tent',
  price: 1200,
  stock_quantity: 4,
  minimum_price: 950,
  allow_negotiation: true,
  status: 'pending_review' as const,
  rejection_reason: null,
  images: [],
  variants: [],
  category: { id: 2, name: 'Camping' },
  category_id: 2,
  store: { id: 3, name: 'Sahara Gear', slug: 'sahara-gear' },
  featured: false,
  views_count: 0,
  sales_count: 0,
  rating_avg: 0,
  primary_image_url: null,
  published_at: null,
  created_at: '2026-11-20T10:00:00Z',
  updated_at: '2026-11-20T10:00:00Z',
}

describe('ProductModerationPage', () => {
  it('shows a retryable error when the queue cannot be loaded', async () => {
    vi.mocked(adminService.moderationQueue)
      .mockRejectedValueOnce(new ApiError('Server unavailable', 500))
      .mockResolvedValueOnce({ data: [], meta: { ...meta, total: 0 } })

    render(<MemoryRouter><ProductModerationPage /></MemoryRouter>)

    expect(await screen.findByText('Could not load the moderation queue')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Server unavailable')

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Queue is empty')).toBeInTheDocument()
  })

  it('approves a product and refreshes the queue', async () => {
    vi.mocked(adminService.moderationQueue)
      .mockResolvedValueOnce({ data: [product], meta })
      .mockResolvedValueOnce({ data: [], meta: { ...meta, total: 0 } })
    vi.mocked(adminService.approveProduct).mockResolvedValue(product)

    render(<MemoryRouter><ProductModerationPage /></MemoryRouter>)

    await userEvent.click(await screen.findByRole('button', { name: 'Approve' }))
    expect(adminService.approveProduct).toHaveBeenCalledWith(12)
    expect(await screen.findByText('Queue is empty')).toBeInTheDocument()
  })
})
