import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { type Address, accountService } from '../accountService'
import AddressesPage from './AddressesPage'

vi.mock('../accountService', () => ({
  accountService: { addresses: vi.fn(), deleteAddress: vi.fn(), setDefaultAddress: vi.fn(), createAddress: vi.fn(), updateAddress: vi.fn() },
}))

const home: Address = { id: 1, label: 'Home', full_name: 'Salma B', phone: '0612345678', address_line1: '10 Rue Atlas', address_line2: null, city: 'Casablanca', region: null, postal_code: '20000', country: 'MA', is_default: true }
const work: Address = { ...home, id: 2, label: 'Work', address_line1: '5 Bd Zerktouni', is_default: false }

describe('AddressesPage', () => {
  beforeEach(() => vi.resetAllMocks())

  it('lists addresses with the default first and badge', async () => {
    vi.mocked(accountService.addresses).mockResolvedValue([home, work])
    render(<AddressesPage />)

    expect(await screen.findByText('10 Rue Atlas', { exact: false })).toBeInTheDocument()
    expect(screen.getByText('Default')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Set as default' })).toHaveLength(1)
  })

  it('confirms before deleting', async () => {
    vi.mocked(accountService.addresses).mockResolvedValueOnce([home, work]).mockResolvedValueOnce([home])
    vi.mocked(accountService.deleteAddress).mockResolvedValue()
    render(<AddressesPage />)

    await userEvent.click((await screen.findAllByRole('button', { name: 'Delete' }))[1])
    const dialog = screen.getByRole('dialog', { name: 'Delete address?' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))

    expect(accountService.deleteAddress).toHaveBeenCalledWith(2)
    expect(await screen.findAllByRole('listitem')).toHaveLength(1)
  })

  it('validates the add-address form', async () => {
    vi.mocked(accountService.addresses).mockResolvedValue([])
    render(<AddressesPage />)

    await userEvent.click(await screen.findByRole('button', { name: 'Add address' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save address' }))

    expect(await screen.findByText('Enter the recipient name.')).toBeInTheDocument()
    expect(accountService.createAddress).not.toHaveBeenCalled()
  })
})
