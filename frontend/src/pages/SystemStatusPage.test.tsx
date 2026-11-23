import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/services/api/types'
import { systemService } from '@/services/systemService'
import SystemStatusPage from './SystemStatusPage'

vi.mock('@/services/systemService', () => ({
  systemService: { health: vi.fn(), csrf: vi.fn() },
}))

const renderPage = () =>
  render(
    <MemoryRouter>
      <SystemStatusPage />
    </MemoryRouter>,
  )

describe('SystemStatusPage', () => {
  beforeEach(() => vi.resetAllMocks())

  it('shows operational state when the API and database are healthy', async () => {
    vi.mocked(systemService.health).mockResolvedValue({
      status: 'ok',
      app: 'NegoMarket',
      api_version: 'v1',
      environment: 'testing',
      server_time: new Date().toISOString(),
      checks: { database: { ok: true, latency_ms: 1.2 } },
    })
    vi.mocked(systemService.csrf).mockResolvedValue(true)

    renderPage()

    expect(await screen.findByText(/NegoMarket v1/)).toBeInTheDocument()
    expect(await screen.findByText(/Connected · 1.2 ms/)).toBeInTheDocument()
    expect(await screen.findByText(/Cookie set/)).toBeInTheDocument()
    expect(screen.getByTestId('overall-status')).toHaveTextContent('operational')
  })

  it('shows an unreachable state when the API is down', async () => {
    vi.mocked(systemService.health).mockRejectedValue(new ApiError('Unable to reach the NegoMarket API.', 0))
    vi.mocked(systemService.csrf).mockRejectedValue(new ApiError('Unable to reach the NegoMarket API.', 0))

    renderPage()

    expect((await screen.findAllByText(/Unreachable/)).length).toBeGreaterThan(0)
    expect(screen.getByTestId('overall-status')).toHaveTextContent('issues')
  })
})
