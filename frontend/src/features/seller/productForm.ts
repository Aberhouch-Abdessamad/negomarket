import { z } from 'zod'
import type { ProductPayload, SellerProduct } from './types'

const money = z.string().trim().regex(/^\d+(\.\d{1,2})?$/, 'Enter an amount like 1200 or 1199.99.')
const optionalMoney = z.union([money, z.literal('')])
const sku = z.string().trim().min(1, 'SKU is required.').max(64).regex(/^[A-Za-z0-9._-]+$/, 'Use letters, numbers, dots, dashes or underscores.')
const stock = z.string().trim().regex(/^\d+$/, 'Enter a whole number (0 or more).')

export const variantRow = z.object({
  id: z.number().optional(),
  sku,
  values: z.record(z.string(), z.string().trim().min(1, 'Required').max(40)),
  price: optionalMoney,
  stock_quantity: stock,
})

/** Client-side mirror of the backend ProductRequest. The API stays the source of truth. */
export const productFormSchema = z
  .object({
    name: z.string().trim().min(3, 'Use at least 3 characters.').max(160),
    sku,
    category_id: z.string().min(1, 'Choose a category.'),
    description: z.string().max(20000).optional(),
    price: money,
    allow_negotiation: z.boolean(),
    minimum_price: optionalMoney,
    use_variants: z.boolean(),
    stock_quantity: z.string(),
    option_names: z.string(),
    variants: z.array(variantRow),
  })
  .superRefine((v, ctx) => {
    const price = Number(v.price)
    if (v.allow_negotiation) {
      if (!v.minimum_price) ctx.addIssue({ code: 'custom', path: ['minimum_price'], message: 'Set your minimum acceptable price to enable negotiation.' })
      else if (Number(v.minimum_price) > price) ctx.addIssue({ code: 'custom', path: ['minimum_price'], message: 'The minimum price must be less than or equal to the listed price.' })
      else if (Number(v.minimum_price) <= 0) ctx.addIssue({ code: 'custom', path: ['minimum_price'], message: 'Must be greater than zero.' })
    }
    if (price <= 0) ctx.addIssue({ code: 'custom', path: ['price'], message: 'Price must be greater than zero.' })

    if (!v.use_variants) {
      if (!/^\d+$/.test(v.stock_quantity.trim())) ctx.addIssue({ code: 'custom', path: ['stock_quantity'], message: 'Enter a whole number (0 or more).' })
      return
    }
    const names = optionNames(v.option_names)
    if (names.length === 0) ctx.addIssue({ code: 'custom', path: ['option_names'], message: 'Add at least one option name, e.g. “size” or “color, size”.' })
    if (names.length > 4) ctx.addIssue({ code: 'custom', path: ['option_names'], message: 'Use at most 4 options.' })
    if (v.variants.length === 0) ctx.addIssue({ code: 'custom', path: ['variants'], message: 'Add at least one variant.' })

    const seen = new Set<string>()
    const skus = new Set<string>()
    v.variants.forEach((row, i) => {
      const combo = names.map((n) => (row.values[n] ?? '').trim().toLowerCase()).join('|')
      names.forEach((n) => {
        if (!row.values[n]?.trim()) ctx.addIssue({ code: 'custom', path: ['variants', i, 'values', n], message: 'Required' })
      })
      if (seen.has(combo)) ctx.addIssue({ code: 'custom', path: ['variants', i, 'sku'], message: 'Duplicate option combination.' })
      seen.add(combo)
      if (skus.has(row.sku.toUpperCase())) ctx.addIssue({ code: 'custom', path: ['variants', i, 'sku'], message: 'Duplicate SKU.' })
      skus.add(row.sku.toUpperCase())
      if (v.allow_negotiation && v.minimum_price && row.price && Number(row.price) < Number(v.minimum_price)) {
        ctx.addIssue({ code: 'custom', path: ['variants', i, 'price'], message: 'Below your minimum price.' })
      }
    })
  })

export type ProductFormValues = z.infer<typeof productFormSchema>

export function optionNames(raw: string): string[] {
  return [...new Set(raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean))]
}

export function toFormValues(p?: SellerProduct): ProductFormValues {
  const variants = p?.variants ?? []
  const names = variants.length ? Object.keys(variants[0].attributes) : []
  return {
    name: p?.name ?? '',
    sku: p?.sku ?? '',
    category_id: p ? String(p.category_id) : '',
    description: p?.description ?? '',
    price: p ? String(p.price) : '',
    allow_negotiation: p?.allow_negotiation ?? false,
    minimum_price: p?.minimum_price != null ? String(p.minimum_price) : '',
    use_variants: variants.length > 0,
    stock_quantity: p ? String(p.stock_quantity) : '0',
    option_names: names.join(', '),
    variants: variants.map((v) => ({ id: v.id, sku: v.sku, values: { ...v.attributes }, price: v.price != null ? String(v.price) : '', stock_quantity: String(v.stock_quantity) })),
  }
}

export function toPayload(v: ProductFormValues): ProductPayload {
  const names = optionNames(v.option_names)
  return {
    name: v.name.trim(),
    sku: v.sku.trim(),
    category_id: Number(v.category_id),
    description: v.description?.trim() || undefined,
    price: Number(v.price),
    allow_negotiation: v.allow_negotiation,
    minimum_price: v.allow_negotiation ? Number(v.minimum_price) : null,
    ...(v.use_variants
      ? {
          variants: v.variants.map((row) => ({
            ...(row.id ? { id: row.id } : {}),
            sku: row.sku.trim(),
            attributes: Object.fromEntries(names.map((n) => [n, row.values[n].trim()])),
            price: row.price ? Number(row.price) : null,
            stock_quantity: Number(row.stock_quantity),
          })),
        }
      : { stock_quantity: Number(v.stock_quantity) }),
  }
}
