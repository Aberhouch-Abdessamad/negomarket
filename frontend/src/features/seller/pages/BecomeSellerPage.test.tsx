import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/store/authStore'
import { makeUser } from '@/test/fixtures'
import { sellerService } from '../sellerService'
import BecomeSellerPage from './BecomeSellerPage'

vi.mock('../sellerService', () => ({ sellerService: { application: vi.fn(), apply: vi.fn() } }))

const app = { id: 1, business_name: 'Sahara Gear', description: 'Camping gear for desert trips and more.', contact_phone: '0612345678', address: '1 Rue', city: 'Fes', admin_notes: null, reviewed_at: null, created_at: '2026-11-20T10:00:00Z' }
const renderPage = () => render(<MemoryRouter><BecomeSellerPage /></MemoryRouter>)

describe('BecomeSellerPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    useAuthStore.setState({ status: 'authenticated', user: makeUser() })
  })

  it('submits an application', async () => {
    vi.mocked(sellerService.application).mockResolvedValueOnce(null).mockResolvedValue({ ...app, status: 'pending' })
    vi.mocked(sellerService.apply).mockResolvedValue({ ...app, status: 'pending' })
    renderPage()

    await userEvent.type(await screen.findByLabelText(/Business \/ store name/), 'Sahara Gear')
    await userEvent.type(screen.getByLabelText(/What will you sell/), 'Camping gear for desert trips and more.')
    await userEvent.type(screen.getByLabelText(/Contact phone/), '0612345678')
    await userEvent.type(screen.getByLabelText(/^City/), 'Fes')
    await userEvent.type(screen.getByLabelText(/Business address/), '1 Rue')
    await userEvent.click(screen.getByRole('checkbox'))
    await userEvent.click(screen.getByRole('button', { name: 'Submit application' }))

    expect(await screen.findByText('Application under review')).toBeInTheDocument()
    expect(sellerService.apply).toHaveBeenCalledWith(expect.objectContaining({ business_name: 'Sahara Gear', accept_seller_terms: true }))
  })

  it('shows rejection notes and allows re-applying with previous data', async () => {
    vi.mocked(sellerService.application).mockResolvedValue({ ...app, status: 'rejected', admin_notes: 'Add a real address.' })
    renderPage()
    expect(await screen.findByText('Add a real address.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Update and re-apply' }))
    expect(screen.getByLabelText(/Business \/ store name/)).toHaveValue('Sahara Gear')
  })

  it('allows an unverified account to apply', async () => {
    useAuthStore.setState({ status: 'authenticated', user: makeUser({ email_verified: false }) })
    vi.mocked(sellerService.application).mockResolvedValue(null)
    renderPage()
    expect(await screen.findByLabelText(/Business \/ store name/)).toBeInTheDocument()
  })
})
