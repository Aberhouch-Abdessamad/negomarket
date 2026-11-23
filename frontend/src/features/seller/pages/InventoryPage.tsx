import { zodResolver } from '@hookform/resolvers/zod'
import { Boxes, History, ImageOff, Search, SlidersHorizontal } from 'lucide-react'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useSearchParams } from 'react-router'
import { z } from 'zod'
import { Alert, Badge, Button, EmptyState, Input, Modal, Pagination, Select, Skeleton, Table, TableWrap, Tabs, Td, Th } from '@/components/ui'
import { useAsync } from '@/hooks/useAsync'
import { toast } from '@/store/toastStore'
import { cn } from '@/utils/cn'
import { applyServerErrors } from '@/utils/forms'
import { formatDate } from '@/utils/format'
import { sellerService } from '../sellerService'
import type { InventoryMovement } from '../types'

interface Target {
  productId: number
  variantId: number | null
  label: string
  current: number
}

const movementLabels: Record<InventoryMovement['type'], string> = {
  initial: 'Initial stock', restock: 'Restock', adjustment: 'Adjustment', sale: 'Sale', cancellation_restore: 'Cancellation', return_restore: 'Return',
}

export default function InventoryPage() {
  const [params, setParams] = useSearchParams()
  const [tab, setTab] = useState<'stock' | 'history'>('stock')
  const [target, setTarget] = useState<Target | null>(null)
  const [q, setQ] = useState(params.get('q') ?? '')
  const page = Number(params.get('page') ?? 1)
  const stock = params.get('stock') ?? ''

  const inventory = useAsync(() => sellerService.inventory({ q: params.get('q') ?? undefined, stock: stock || undefined, page }), [params.toString()])
  const [historyPage, setHistoryPage] = useState(1)
  const history = useAsync(() => (tab === 'history' ? sellerService.movements({ page: historyPage }) : Promise.resolve(null)), [tab, historyPage])
  const low = inventory.data?.meta.low_stock_threshold ?? 5

  const set = (patch: Record<string, string>) => setParams((prev) => {
    const n = new URLSearchParams(prev)
    Object.entries(patch).forEach(([k, v]) => (v ? n.set(k, v) : n.delete(k)))
    if (!('page' in patch)) n.delete('page')
    return n
  })

  const stockBadge = (n: number) => <Badge tone={n === 0 ? 'danger' : n <= low ? 'warning' : 'success'}>{n}</Badge>

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Inventory</h1>
          <p className="mt-1 text-sm text-ink-muted">Every change is recorded in the stock history. Stock can never go below zero.</p>
        </div>
        <Tabs label="Inventory view" value={tab} onChange={setTab} items={[{ value: 'stock', label: 'Stock levels' }, { value: 'history', label: 'History' }]} />
      </div>

      {tab === 'stock' ? (
        <>
          <div className="flex flex-col gap-3 sm:flex-row">
            <form className="relative flex-1" onSubmit={(e) => { e.preventDefault(); set({ q }) }}>
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or SKU" aria-label="Search inventory" className="h-11 w-full rounded-xl border border-line bg-surface pl-10 pr-4 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100" />
            </form>
            <div className="sm:w-52">
              <Select aria-label="Stock filter" value={stock} placeholder="All products" options={[{ value: 'low', label: `Low stock (≤ ${low})` }, { value: 'out', label: 'Out of stock' }]} onChange={(e) => set({ stock: e.target.value })} />
            </div>
          </div>
          {inventory.error && <Alert tone="danger">{inventory.error.message}</Alert>}
          {inventory.data?.data.length === 0 ? (
            <EmptyState icon={Boxes} title="Nothing to show" message="No products match this filter." />
          ) : (
            <TableWrap>
              <Table>
                <thead><tr><Th>Product / variant</Th><Th>SKU</Th><Th className="text-right">In stock</Th><Th className="text-right"><span className="sr-only">Actions</span></Th></tr></thead>
                <tbody>
                  {inventory.loading && !inventory.data
                    ? Array.from({ length: 5 }, (_, i) => <tr key={i}><Td colSpan={4}><Skeleton className="h-9" /></Td></tr>)
                    : inventory.data?.data.flatMap((row) => [
                        <tr key={`p${row.product_id}`} className={cn(row.variants.length && 'bg-canvas/50')}>
                          <Td>
                            <div className="flex items-center gap-3">
                              <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-canvas">{row.image_url ? <img src={row.image_url} alt="" className="size-full object-cover" /> : <ImageOff className="size-4 text-ink-subtle" />}</span>
                              <span className="font-medium">{row.name}</span>
                            </div>
                          </Td>
                          <Td className="text-ink-muted">{row.sku}</Td>
                          <Td className="text-right">{row.variants.length ? <span className="text-xs text-ink-subtle">Total </span> : null}{stockBadge(row.stock_quantity)}</Td>
                          <Td className="text-right">
                            {!row.variants.length && <Button size="sm" variant="secondary" leftIcon={<SlidersHorizontal className="size-3.5" />} onClick={() => setTarget({ productId: row.product_id, variantId: null, label: row.name, current: row.stock_quantity })}>Adjust</Button>}
                          </Td>
                        </tr>,
                        ...row.variants.map((v) => (
                          <tr key={`v${v.id}`}>
                            <Td className="pl-16 text-ink-muted">{Object.values(v.attributes).join(' / ')}</Td>
                            <Td className="text-ink-muted">{v.sku}</Td>
                            <Td className="text-right">{stockBadge(v.stock_quantity)}</Td>
                            <Td className="text-right"><Button size="sm" variant="secondary" leftIcon={<SlidersHorizontal className="size-3.5" />} onClick={() => setTarget({ productId: row.product_id, variantId: v.id, label: `${row.name} – ${Object.values(v.attributes).join(' / ')}`, current: v.stock_quantity })}>Adjust</Button></Td>
                          </tr>
                        )),
                      ])}
                </tbody>
              </Table>
            </TableWrap>
          )}
          {inventory.data && <Pagination page={inventory.data.meta.current_page} lastPage={inventory.data.meta.last_page} onChange={(p) => set({ page: String(p) })} />}
        </>
      ) : (
        <>
          <TableWrap>
            <Table>
              <thead><tr><Th>Date</Th><Th>Product</Th><Th>Type</Th><Th className="text-right">Change</Th><Th className="text-right">After</Th><Th>By / note</Th></tr></thead>
              <tbody>
                {history.loading && !history.data
                  ? <tr><Td colSpan={6}><Skeleton className="h-24" /></Td></tr>
                  : history.data?.data.map((m) => (
                      <tr key={m.id}>
                        <Td className="whitespace-nowrap text-ink-muted">{formatDate(m.created_at)}</Td>
                        <Td><span className="font-medium">{m.product?.name}</span>{m.variant && <span className="block text-xs text-ink-subtle">{Object.values(m.variant.attributes).join(' / ')}</span>}</Td>
                        <Td><Badge tone={m.type === 'sale' ? 'brand' : 'neutral'}>{movementLabels[m.type]}</Badge></Td>
                        <Td className={cn('text-right font-semibold', m.quantity_change < 0 ? 'text-danger-600' : 'text-success-600')}>{m.quantity_change > 0 ? '+' : ''}{m.quantity_change}</Td>
                        <Td className="text-right">{m.quantity_after}</Td>
                        <Td className="text-ink-muted">{m.actor ?? 'System'}{m.note && <span className="block text-xs text-ink-subtle">{m.note}</span>}</Td>
                      </tr>
                    ))}
                {history.data?.data.length === 0 && <tr><Td colSpan={6} className="py-10 text-center text-ink-muted"><History className="mx-auto mb-2 size-5" />No stock movements yet.</Td></tr>}
              </tbody>
            </Table>
          </TableWrap>
          {history.data && <Pagination page={history.data.meta.current_page} lastPage={history.data.meta.last_page} onChange={setHistoryPage} />}
        </>
      )}

      <Modal open={target !== null} onClose={() => setTarget(null)} title="Adjust stock" description={target?.label}>
        {target && <AdjustForm target={target} onDone={() => { setTarget(null); inventory.reload() }} />}
      </Modal>
    </div>
  )
}

const adjustSchema = z.object({
  mode: z.enum(['set', 'add', 'remove']),
  quantity: z.string().regex(/^\d+$/, 'Enter a whole number.'),
  note: z.string().max(255).optional(),
})

function AdjustForm({ target, onDone }: { target: Target; onDone: () => void }) {
  const [formError, setFormError] = useState<string | null>(null)
  const { register, handleSubmit, control, setError, formState: { errors, isSubmitting } } = useForm<z.infer<typeof adjustSchema>>({
    resolver: zodResolver(adjustSchema),
    defaultValues: { mode: 'add', quantity: '', note: '' },
  })
  const [mode, quantity] = useWatch({ control, name: ['mode', 'quantity'] })
  const qty = Number(quantity || 0)
  const preview = mode === 'set' ? qty : mode === 'add' ? target.current + qty : target.current - qty

  const onSubmit = handleSubmit(async (v) => {
    setFormError(null)
    try {
      toast.success(await sellerService.adjustStock({ product_id: target.productId, product_variant_id: target.variantId, mode: v.mode, quantity: Number(v.quantity), note: v.note || undefined }))
      onDone()
    } catch (e) {
      setFormError(applyServerErrors(e, setError, ['quantity', 'note']))
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {formError && <Alert tone="danger">{formError}</Alert>}
      <p className="text-sm text-ink-muted">Current stock: <span className="font-semibold text-ink">{target.current}</span></p>
      <Select label="Action" options={[{ value: 'add', label: 'Add stock (restock)' }, { value: 'remove', label: 'Remove stock (damaged, lost…)' }, { value: 'set', label: 'Set exact level (stock count)' }]} {...register('mode')} />
      <Input label="Quantity" inputMode="numeric" error={errors.quantity?.message} {...register('quantity')} />
      <Input label="Note" placeholder="Optional, e.g. supplier delivery #123" {...register('note')} />
      <p className={cn('text-sm', preview < 0 ? 'font-medium text-danger-600' : 'text-ink-muted')}>
        New stock: <span className="font-semibold">{preview < 0 ? 'not allowed (below zero)' : preview}</span>
      </p>
      <div className="flex justify-end"><Button type="submit" loading={isSubmitting} disabled={preview < 0}>Save adjustment</Button></div>
    </form>
  )
}
