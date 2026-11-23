import { describe, expect, it } from 'vitest'
import { productFormSchema, toFormValues, toPayload } from './productForm'

const base = { ...toFormValues(), name: 'Leather Bag', sku: 'BAG-1', category_id: '3', price: '1200', stock_quantity: '4' }

describe('product form', () => {
  it('builds a simple-product payload', () => {
    const v = productFormSchema.parse({ ...base, allow_negotiation: true, minimum_price: '900' })
    expect(toPayload(v)).toEqual({ name: 'Leather Bag', sku: 'BAG-1', category_id: 3, description: undefined, price: 1200, allow_negotiation: true, minimum_price: 900, stock_quantity: 4 })
  })

  it('enforces negotiation rules', () => {
    const issues = (o: object) => productFormSchema.safeParse({ ...base, ...o }).error?.issues.map((i) => i.message) ?? []
    expect(issues({ allow_negotiation: true, minimum_price: '' })).toContain('Set your minimum acceptable price to enable negotiation.')
    expect(issues({ allow_negotiation: true, minimum_price: '1500' })).toContain('The minimum price must be less than or equal to the listed price.')
    expect(issues({ price: '12.345' })[0]).toMatch(/amount like/)
  })

  it('validates and serialises variants', () => {
    const variants = [
      { sku: 'B-BLK', values: { color: 'Black' }, price: '', stock_quantity: '2' },
      { id: 7, sku: 'B-TAN', values: { color: 'Tan' }, price: '1300', stock_quantity: '1' },
    ]
    const v = productFormSchema.parse({ ...base, use_variants: true, option_names: 'Color', variants })
    const payload = toPayload(v)
    expect(payload.stock_quantity).toBeUndefined()
    expect(payload.variants).toEqual([
      { sku: 'B-BLK', attributes: { color: 'Black' }, price: null, stock_quantity: 2 },
      { id: 7, sku: 'B-TAN', attributes: { color: 'Tan' }, price: 1300, stock_quantity: 1 },
    ])

    const dup = productFormSchema.safeParse({ ...base, use_variants: true, option_names: 'color', variants: [variants[0], { ...variants[0], sku: 'X' }] })
    expect(dup.error?.issues.map((i) => i.message)).toContain('Duplicate option combination.')
    const missing = productFormSchema.safeParse({ ...base, use_variants: true, option_names: 'color, size', variants })
    expect(missing.success).toBe(false)
  })
})
