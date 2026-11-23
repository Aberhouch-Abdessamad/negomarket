import { describe, expect, it } from 'vitest'
import { addressSchema, changePasswordSchema, registerSchema } from './schemas'

const valid = { name: 'Salma B', email: 'salma@example.com', phone: '', password: 'secret123', password_confirmation: 'secret123', accept_terms: true }

describe('auth schemas', () => {
  it('accepts a valid registration', () => {
    expect(registerSchema.safeParse(valid).success).toBe(true)
  })

  it.each([
    [{ password: 'short1', password_confirmation: 'short1' }, 'password'],
    [{ password: 'onlyletters', password_confirmation: 'onlyletters' }, 'password'],
    [{ password: '12345678', password_confirmation: '12345678' }, 'password'],
    [{ password_confirmation: 'different1' }, 'password_confirmation'],
    [{ accept_terms: false }, 'accept_terms'],
    [{ email: 'not-an-email' }, 'email'],
    [{ phone: 'abc' }, 'phone'],
  ])('rejects %o on %s', (patch, field) => {
    const result = registerSchema.safeParse({ ...valid, ...patch })
    expect(result.success).toBe(false)
    expect(result.error?.issues.map((i) => i.path[0])).toContain(field)
  })

  it('requires the new password to differ from the current one', () => {
    const r = changePasswordSchema.safeParse({ current_password: 'secret123', password: 'secret123', password_confirmation: 'secret123' })
    expect(r.success).toBe(false)
  })

  it('validates addresses', () => {
    expect(addressSchema.safeParse({ full_name: 'A B', phone: '0612345678', address_line1: '1 Rue X', city: 'Rabat' }).success).toBe(true)
    expect(addressSchema.safeParse({ full_name: '', phone: '1', address_line1: '', city: '' }).success).toBe(false)
  })
})
