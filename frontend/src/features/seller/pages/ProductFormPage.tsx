import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, ExternalLink, Lock, Plus, Send, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router'
import { Alert, Button, Card, CardBody, FullPageSpinner, Input, Select, Switch, Textarea } from '@/components/ui'
import { marketplaceService } from '@/features/marketplace/marketplaceService'
import { useAsync } from '@/hooks/useAsync'
import NotFoundPage from '@/pages/NotFoundPage'
import { ApiError } from '@/services/api/types'
import { toast } from '@/store/toastStore'
import { applyServerErrors } from '@/utils/forms'
import { formatPrice } from '@/utils/format'
import { ImageManager } from '../components/ImageManager'
import { ProductStatusBadge } from '../components/ProductStatusBadge'
import { type ProductFormValues, optionNames, productFormSchema, toFormValues, toPayload } from '../productForm'
import { sellerService } from '../sellerService'
import type { SellerProduct } from '../types'
import type { Category } from '@/features/marketplace/types'

export default function ProductFormPage() {
  const { id } = useParams()
  const editing = id !== undefined
  const product = useAsync(() => (editing ? sellerService.product(Number(id)) : Promise.resolve(undefined)), [id])
  const categories = useAsync(() => marketplaceService.categories(), [])

  if (product.error?.status === 404 || product.error?.status === 403) return <NotFoundPage />
  // The category <select> must have its options before react-hook-form sets its value.
  if ((editing && !product.data) || !categories.data) return <FullPageSpinner />
  return <ProductEditor key={id ?? 'new'} initial={product.data} categories={categories.data} />
}

function ProductEditor({ initial, categories }: { initial?: SellerProduct; categories: Category[] }) {
  const navigate = useNavigate()
  const [product, setProduct] = useState<SellerProduct | undefined>(initial)
  const [formError, setFormError] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)
  const categoryOptions = useMemo(
    () => categories.flatMap((c) => [{ value: String(c.id), label: c.name }, ...(c.children ?? []).map((ch) => ({ value: String(ch.id), label: `${c.name} › ${ch.name}` }))]),
    [categories],
  )

  const { register, control, handleSubmit, setError, reset, formState: { errors, isSubmitting, isDirty } } = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: toFormValues(initial),
  })
  const variants = useFieldArray({ control, name: 'variants' })
  const [allowNegotiation, useVariants, optionsRaw, price] = useWatch({ control, name: ['allow_negotiation', 'use_variants', 'option_names', 'price'] })
  const names = optionNames(optionsRaw)

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      const saved = product ? await sellerService.updateProduct(product.id, toPayload(values)) : await sellerService.createProduct(toPayload(values))
      reset(toFormValues(saved))
      setProduct(saved)
      if (!product) {
        toast.success('Draft created. Now add photos and publish.')
        navigate(`/seller/products/${saved.id}`, { replace: true })
      } else {
        toast.success('Product saved.')
      }
    } catch (error) {
      const message = applyServerErrors(error, setError, ['name', 'sku', 'category_id', 'description', 'price', 'minimum_price', 'stock_quantity', 'variants'] as never)
      if (error instanceof ApiError && error.isValidationError) {
        // Map nested "variants.0.attributes" style errors onto the form where possible.
        Object.entries(error.errors).forEach(([k, msgs]) => {
          const m = k.match(/^variants\.(\d+)\.(sku|price|stock_quantity)$/)
          if (m) setError(`variants.${Number(m[1])}.${m[2] as 'sku'}`, { message: msgs[0] })
        })
      }
      setFormError(message)
    }
  })

  async function publish(next: 'publish' | 'unpublish') {
    if (!product) return
    if (isDirty) return toast.info('Save your changes first.')
    setPublishing(true)
    try {
      if (next === 'publish') {
        const res = await sellerService.publish(product.id)
        setProduct(res.product)
        toast.success(res.message)
      } else {
        setProduct(await sellerService.unpublish(product.id))
        toast.success('Moved back to draft.')
      }
    } catch (e) {
      toast.error(e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : 'Something went wrong.')
    } finally {
      setPublishing(false)
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link to="/seller/products" className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"><ArrowLeft className="size-4" aria-hidden /> Products</Link>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight">{product ? product.name : 'New product'}</h1>
        </div>
        <div className="flex gap-2">
          <Button type="submit" loading={isSubmitting} disabled={product !== undefined && !isDirty}>
            {product ? 'Save changes' : 'Create draft'}
          </Button>
        </div>
      </div>

      {formError && <Alert tone="danger">{formError}</Alert>}

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <Card>
            <CardBody className="space-y-5">
              <h2 className="font-semibold">Basic information</h2>
              <Input label="Product name" required error={errors.name?.message} {...register('name')} />
              <div className="grid gap-5 sm:grid-cols-2">
                <Input label="SKU" required hint="Unique within your store." error={errors.sku?.message} {...register('sku')} />
                <Select label="Category" placeholder="Choose a category" options={categoryOptions} error={errors.category_id?.message} {...register('category_id')} />
              </div>
              <Textarea label="Description" rows={6} error={errors.description?.message} {...register('description')} />
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-5">
              <h2 className="font-semibold">Pricing &amp; negotiation</h2>
              <Input label="Listed price (MAD)" required inputMode="decimal" error={errors.price?.message} {...register('price')} />
              <Controller control={control} name="allow_negotiation" render={({ field }) => (
                <Switch checked={field.value} onChange={field.onChange} label="Allow price negotiation" description="Customers can send offers; you accept, reject or counter." />
              )} />
              {allowNegotiation && (
                <div className="rounded-xl border border-brand-200 bg-brand-50/50 p-4">
                  <Input label="Minimum acceptable price (MAD)" required inputMode="decimal" error={errors.minimum_price?.message} {...register('minimum_price')} />
                  <p className="mt-2 flex items-start gap-1.5 text-xs text-ink-muted">
                    <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden /> Private: never shown to customers. Offers below it are rejected automatically by the server.
                    {price && ` Must be ≤ ${formatPrice(Number(price) || 0)}.`}
                  </p>
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-5">
              <h2 className="font-semibold">Inventory &amp; variants</h2>
              <Controller control={control} name="use_variants" render={({ field }) => (
                <Switch checked={field.value} onChange={(v) => { field.onChange(v); if (v && variants.fields.length === 0) variants.append({ sku: '', values: {}, price: '', stock_quantity: '0' }) }} label="This product has variants" description="e.g. sizes or colors, each with its own SKU, stock and optional price." />
              )} />

              {!useVariants ? (
                <Input label="Stock quantity" inputMode="numeric" hint="Changes are recorded in your inventory history." error={errors.stock_quantity?.message} {...register('stock_quantity')} className="max-w-48" />
              ) : (
                <div className="space-y-4">
                  <Input label="Option names" placeholder="size, color" hint="Comma-separated, up to 4." error={errors.option_names?.message} {...register('option_names')} />
                  {errors.variants?.message && <p className="text-xs font-medium text-danger-600">{errors.variants.message}</p>}
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px] text-sm">
                      <thead>
                        <tr className="text-left text-xs uppercase tracking-wide text-ink-subtle">
                          {names.map((n) => <th key={n} className="pb-2 pr-2 font-semibold capitalize">{n}</th>)}
                          <th className="pb-2 pr-2 font-semibold">SKU</th>
                          <th className="pb-2 pr-2 font-semibold">Price</th>
                          <th className="pb-2 pr-2 font-semibold">Stock</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {variants.fields.map((f, i) => (
                          <tr key={f.id} className="align-top">
                            {names.map((n) => (
                              <td key={n} className="pb-2 pr-2">
                                <Input aria-label={`Variant ${i + 1} ${n}`} error={errors.variants?.[i]?.values?.[n]?.message} {...register(`variants.${i}.values.${n}` as const)} />
                              </td>
                            ))}
                            <td className="pb-2 pr-2"><Input aria-label={`Variant ${i + 1} SKU`} error={errors.variants?.[i]?.sku?.message} {...register(`variants.${i}.sku`)} /></td>
                            <td className="pb-2 pr-2"><Input aria-label={`Variant ${i + 1} price`} placeholder="Same" inputMode="decimal" error={errors.variants?.[i]?.price?.message} {...register(`variants.${i}.price`)} /></td>
                            <td className="pb-2 pr-2"><Input aria-label={`Variant ${i + 1} stock`} inputMode="numeric" className="w-24" error={errors.variants?.[i]?.stock_quantity?.message} {...register(`variants.${i}.stock_quantity`)} /></td>
                            <td className="pb-2"><Button variant="ghost" size="sm" className="h-11" aria-label={`Remove variant ${i + 1}`} onClick={() => variants.remove(i)}><Trash2 className="size-4" /></Button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Button variant="secondary" size="sm" leftIcon={<Plus className="size-4" />} onClick={() => variants.append({ sku: '', values: {}, price: '', stock_quantity: '0' })} disabled={variants.fields.length >= 50}>
                    Add variant
                  </Button>
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardBody className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Status</h2>
                {product ? <ProductStatusBadge status={product.status} /> : <span className="text-sm text-ink-subtle">Not saved</span>}
              </div>
              {product?.status === 'rejected' && <Alert tone="danger" title="Changes requested">{product.rejection_reason}</Alert>}
              {product?.status === 'pending_review' && <Alert tone="warning">An administrator is reviewing this product.</Alert>}
              {product && ['draft', 'rejected', 'archived'].includes(product.status) && (
                <Button className="w-full" leftIcon={<Send className="size-4" />} loading={publishing} onClick={() => void publish('publish')}>Publish</Button>
              )}
              {product && ['published', 'pending_review'].includes(product.status) && (
                <Button variant="secondary" className="w-full" loading={publishing} onClick={() => void publish('unpublish')}>Unpublish</Button>
              )}
              {product?.status === 'published' && (
                <Link to={`/products/${product.slug}`} className="flex items-center justify-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700">View in marketplace <ExternalLink className="size-3.5" aria-hidden /></Link>
              )}
              {!product && <p className="text-sm text-ink-muted">Save the product as a draft, then add photos and publish it.</p>}
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <h2 className="mb-4 font-semibold">Images</h2>
              {product ? <ImageManager product={product} onChange={setProduct} /> : <p className="text-sm text-ink-muted">You can upload images after creating the draft.</p>}
            </CardBody>
          </Card>
        </div>
      </div>
    </form>
  )
}
