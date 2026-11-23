import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { adminService } from '../adminService'
import SellerApplicationsPage from './SellerApplicationsPage'

vi.mock('../adminService', () => ({ adminService: { applications: vi.fn(), approveApplication: vi.fn(), rejectApplication: vi.fn() } }))

const meta = { current_page: 1, last_page: 1, per_page: 20, total: 1, from: 1, to: 1, pending_count: 1 }
const app = { id: 9, business_name: 'Sahara Gear', description: 'Camping gear', contact_phone: '0612', address: '1 Rue', city: 'Fes', status: 'pending' as const, admin_notes: null, reviewed_at: null, created_at: '2026-11-20T10:00:00Z', applicant: { id: 3, name: 'Hamza', email: 'h@x.com', email_verified: true, member_since: '2026-01-01' } }

describe('SellerApplicationsPage', () => {
  it('approves and rejects with a required reason', async () => {
    vi.mocked(adminService.applications).mockResolvedValue({ data: [app], meta })
    vi.mocked(adminService.approveApplication).mockResolvedValue({ ...app, status: 'approved' })
    vi.mocked(adminService.rejectApplication).mockResolvedValue({ ...app, status: 'rejected' })
    render(<SellerApplicationsPage />)

    await userEvent.click(await screen.findByRole('button', { name: 'Approve' }))
    expect(adminService.approveApplication).toHaveBeenCalledWith(9)

    await userEvent.click(screen.getByRole('button', { name: 'Reject' }))
    const dialog = screen.getByRole('dialog')
    const confirm = within(dialog).getByRole('button', { name: 'Reject application' })
    expect(confirm).toBeDisabled()
    await userEvent.type(within(dialog).getByLabelText(/Reason/), 'Missing address')
    await userEvent.click(confirm)
    expect(adminService.rejectApplication).toHaveBeenCalledWith(9, 'Missing address')
  })
})
