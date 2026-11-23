import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/store/authStore'
import { makeDetail } from '@/test/negotiationFixtures'
import { makeUser } from '@/test/fixtures'
import { negotiationService } from '../negotiationService'
import type { NegotiationMessage } from '../types'
import NegotiationThreadPage, { mergeMessages } from './NegotiationThreadPage'

vi.mock('../negotiationService', () => ({
  negotiationService: {
    get: vi.fn(),
    messages: vi.fn(),
    markRead: vi.fn(),
    sendMessage: vi.fn(),
    accept: vi.fn(),
    reject: vi.fn(),
    cancel: vi.fn(),
  },
}))

vi.mock('../useNegotiationRealtime', () => ({
  useNegotiationRealtime: () => ({ connected: false }),
}))

const message = (overrides: Partial<NegotiationMessage> = {}): NegotiationMessage => ({
  id: 1,
  negotiation_id: 1,
  body: 'Hello there',
  type: 'text',
  offer_id: null,
  client_message_id: null,
  read_at: null,
  sender_id: 5,
  sender: { id: 5, name: 'Salma Customer', avatar_url: null },
  created_at: new Date().toISOString(),
  ...overrides,
})

function renderThread() {
  render(
    <MemoryRouter initialEntries={['/negotiations/1']}>
      <Routes>
        <Route path="/negotiations/:id" element={<NegotiationThreadPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('NegotiationThreadPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    useAuthStore.setState({ status: 'authenticated', user: makeUser({ id: 5, name: 'Salma Customer' }) })
    vi.mocked(negotiationService.get).mockResolvedValue(makeDetail())
    vi.mocked(negotiationService.messages).mockResolvedValue([])
    vi.mocked(negotiationService.markRead).mockResolvedValue({ updated: 0, unread_count: 0 })
  })

  it('shows the offer history and lets the seller accept a customer offer', async () => {
    useAuthStore.setState({
      status: 'authenticated',
      user: makeUser({ id: 2, name: 'Youssef B', is_seller: true, store: { id: 2, name: 'Atlas', slug: 'atlas', status: 'active' } }),
    })
    vi.mocked(negotiationService.get).mockResolvedValue(makeDetail({ role: 'seller' }))
    vi.mocked(negotiationService.accept).mockResolvedValue(makeDetail({ role: 'seller', status: 'accepted', status_label: 'Accepted' }))
    renderThread()

    expect(await screen.findByText('Customer offer')).toBeInTheDocument()
    expect(screen.getAllByText('300 MAD').length).toBeGreaterThan(0)

    await userEvent.click(screen.getByRole('button', { name: 'Accept' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Accept offer' }))

    expect(negotiationService.accept).toHaveBeenCalledWith(1, 10)
    await waitFor(() => expect(negotiationService.get).toHaveBeenCalledTimes(2))
  })

  it('sends a chat message with an idempotency key and renders it immediately', async () => {
    vi.mocked(negotiationService.messages).mockResolvedValue([message()])
    vi.mocked(negotiationService.sendMessage).mockResolvedValue(
      message({ id: 2, body: 'Can you do 320?', sender_id: 5, client_message_id: 'client-1' }),
    )
    renderThread()

    expect(await screen.findByText('Hello there')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Message'), 'Can you do 320?')
    await userEvent.click(screen.getByRole('button', { name: 'Send message' }))

    await waitFor(() =>
      expect(negotiationService.sendMessage).toHaveBeenCalledWith(1, {
        message: 'Can you do 320?',
        client_message_id: expect.any(String),
      }),
    )
    expect(await screen.findByText('Can you do 320?')).toBeInTheDocument()
  })

  it('disables the composer once the negotiation is closed', async () => {
    vi.mocked(negotiationService.get).mockResolvedValue(makeDetail({ status: 'rejected', status_label: 'Rejected', pending_offer: null }))
    renderThread()

    expect(await screen.findByText('This conversation is closed.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Message')).not.toBeInTheDocument()
  })

  it('never leaks the seller minimum price or internal ids', async () => {
    renderThread()
    await screen.findByText('Linen Shirt')
    expect(document.body.textContent).not.toMatch(/minimum/i)
    expect(document.body.textContent).not.toMatch(/minimum_price/i)
  })
})

describe('mergeMessages', () => {
  it('deduplicates optimistic messages by client id and keeps server order', () => {
    const optimistic = message({ id: 99, body: 'hello', client_message_id: 'abc' })
    const server = message({ id: 4, body: 'hello', client_message_id: 'abc' })
    const later = message({ id: 5, body: 'second', client_message_id: null })

    const merged = mergeMessages([optimistic], [server, later])

    expect(merged.map((m) => m.id)).toEqual([4, 5])
  })

  it('updates read receipts for existing messages', () => {
    const before = message({ id: 4, read_at: null })
    const after = message({ id: 4, read_at: '2026-11-22T10:00:00Z' })

    expect(mergeMessages([before], [after])[0].read_at).toBe('2026-11-22T10:00:00Z')
  })
})
