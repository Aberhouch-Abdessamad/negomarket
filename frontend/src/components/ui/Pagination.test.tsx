import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Pagination } from './Pagination'

describe('Pagination', () => {
  it('renders a compact window with ellipses', () => {
    render(<Pagination page={5} lastPage={10} onChange={() => {}} />)
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['', '1', '4', '5', '6', '10', ''])
    expect(screen.getByRole('button', { name: '5' })).toHaveAttribute('aria-current', 'page')
  })

  it('calls onChange and disables edges', async () => {
    const onChange = vi.fn()
    render(<Pagination page={1} lastPage={3} onChange={onChange} />)
    expect(screen.getByLabelText('Previous page')).toBeDisabled()
    await userEvent.click(screen.getByLabelText('Next page'))
    expect(onChange).toHaveBeenCalledWith(2)
  })

  it('renders nothing for a single page', () => {
    const { container } = render(<Pagination page={1} lastPage={1} onChange={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })
})
