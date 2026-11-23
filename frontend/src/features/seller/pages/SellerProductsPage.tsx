import { Eye, EyeOff, ImageOff, MoreHorizontal, Package, Pencil, PackagePlus, Search, Send, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Alert, Badge, ConfirmDialog, Dropdown, DropdownItem, EmptyState, Pagination, Select, Skeleton, Table, TableWrap, Td, Th } from '@/components/ui'
import { useAsync } from '@/hooks/useAsync'
import { ApiError } from '@/services/api/types'
import { toast } from '@/store/toastStore'
import { formatPrice } from '@/utils/format'
import { ProductStatusBadge } from '../components/ProductStatusBadge'
import { sellerService } from '../sellerService'
import type { SellerProduct } from '../types'

const STATUS = [
  { value: 'draft', label: 'Draft' },
  { value: 'pending_review', label: 'In review' },
  { value: 'published', label: 'Published' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'archived', label: 'Archived' },
]

export default function SellerProductsPage() {
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState(params.get('q') ?? '')
  const [deleting, setDeleting] = useState<SellerProduct | null>(null)
  const [busy, setBusy] = useState(false)
  const filters = { q: params.get('q') ?? undefined, status: params.get('status') ?? undefined, stock: params.get('stock') ?? undefined, page: Number(params.get('page') ?? 1) }
  const { data, loading, error, reload } = useAsync(() => sellerService.products(filters), [params.toString()])

  const set = (patch: Record<string, string | undefined>) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)))
      if (!('page' in patch)) next.delete('page')
      return next
    })

  async function run(action: () => Promise<string | unknown>, success?: string) {
    try {
      const msg = await action()
      toast.success(typeof msg === 'string' && msg ? msg : (success ?? 'Done.'))
      reload()
    } catch (e) {
      toast.error(e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : 'Something went wrong.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Products</h1>
          <p className="mt-1 text-sm text-ink-muted">{data ? `${data.meta.total} products` : 'Manage your catalog.'}</p>
        </div>
        <Link to="/seller/products/new" className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-brand-700">
          <PackagePlus className="size-4" aria-hidden /> Add product
        </Link>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <form className="relative flex-1" onSubmit={(e) => { e.preventDefault(); set({ q }) }}>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or SKU" aria-label="Search products" className="h-11 w-full rounded-xl border border-line bg-surface pl-10 pr-4 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100" />
        </form>
        <div className="grid grid-cols-2 gap-3 sm:w-96">
          <Select aria-label="Status" value={filters.status ?? ''} placeholder="All statuses" options={STATUS} onChange={(e) => set({ status: e.target.value })} />
          <Select aria-label="Stock" value={filters.stock ?? ''} placeholder="All stock" options={[{ value: 'in', label: 'In stock' }, { value: 'low', label: 'Low stock' }, { value: 'out', label: 'Out of stock' }]} onChange={(e) => set({ stock: e.target.value })} />
        </div>
      </div>

      {error && <Alert tone="danger">{error.message}</Alert>}

      {data && data.data.length === 0 ? (
        <EmptyState icon={Package} title="No products yet" message="Create your first product, add photos and publish it to the marketplace." action={<Link to="/seller/products/new" className="text-sm font-medium text-brand-600">Add a product →</Link>} />
      ) : (
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>Product</Th><Th>Status</Th><Th className="text-right">Price</Th><Th className="text-right">Stock</Th><Th className="text-center">Offers</Th><Th className="text-right">Views</Th><Th><span className="sr-only">Actions</span></Th>
              </tr>
            </thead>
            <tbody>
              {loading && !data
                ? Array.from({ length: 5 }, (_, i) => (<tr key={i}><Td colSpan={7}><Skeleton className="h-10" /></Td></tr>))
                : data?.data.map((p) => (
                    <tr key={p.id} className="hover:bg-canvas/60">
                      <Td>
                        <div className="flex items-center gap-3">
                          <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-lg bg-canvas">
                            {p.primary_image_url ? <img src={p.primary_image_url} alt="" className="size-full object-cover" /> : <ImageOff className="size-4 text-ink-subtle" aria-hidden />}
                          </span>
                          <div className="min-w-0">
                            <Link to={`/seller/products/${p.id}`} className="block max-w-xs truncate font-medium hover:text-brand-700">{p.name}</Link>
                            <p className="text-xs text-ink-subtle">{p.sku} · {p.category?.name}</p>
                          </div>
                        </div>
                      </Td>
                      <Td>
                        <ProductStatusBadge status={p.status} />
                        {p.status === 'rejected' && p.rejection_reason && <p className="mt-1 max-w-48 truncate text-xs text-danger-600" title={p.rejection_reason}>{p.rejection_reason}</p>}
                      </Td>
                      <Td className="text-right font-medium">{formatPrice(p.price)}</Td>
                      <Td className="text-right">
                        <Badge tone={p.stock_quantity === 0 ? 'danger' : p.stock_quantity <= 5 ? 'warning' : 'neutral'}>{p.stock_quantity}</Badge>
                      </Td>
                      <Td className="text-center">{p.allow_negotiation ? <Badge tone="brand">On</Badge> : <span className="text-ink-subtle">–</span>}</Td>
                      <Td className="text-right text-ink-muted">{p.views_count}</Td>
                      <Td className="text-right">
                        <Dropdown label={`Actions for ${p.name}`} trigger={<span className="grid size-8 place-items-center rounded-lg text-ink-muted hover:bg-canvas"><MoreHorizontal className="size-4" /></span>}>
                          {(close) => (
                            <>
                              <Link to={`/seller/products/${p.id}`} onClick={close} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-canvas"><Pencil className="size-4" /> Edit</Link>
                              {p.status === 'published' && <Link to={`/products/${p.slug}`} onClick={close} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-canvas"><Eye className="size-4" /> View in marketplace</Link>}
                              {['draft', 'rejected', 'archived'].includes(p.status) && (
                                <DropdownItem icon={<Send className="size-4" />} onSelect={() => { close(); void run(async () => (await sellerService.publish(p.id)).message) }}>Publish</DropdownItem>
                              )}
                              {['published', 'pending_review'].includes(p.status) && (
                                <DropdownItem icon={<EyeOff className="size-4" />} onSelect={() => { close(); void run(() => sellerService.unpublish(p.id), 'Moved back to draft.') }}>Unpublish</DropdownItem>
                              )}
                              <DropdownItem danger icon={<Trash2 className="size-4" />} onSelect={() => { close(); setDeleting(p) }}>Delete</DropdownItem>
                            </>
                          )}
                        </Dropdown>
                      </Td>
                    </tr>
                  ))}
            </tbody>
          </Table>
        </TableWrap>
      )}
      {data && <Pagination page={data.meta.current_page} lastPage={data.meta.last_page} onChange={(p) => set({ page: String(p) })} />}

      <ConfirmDialog
        open={deleting !== null}
        title="Delete product?"
        message={`“${deleting?.name}” will be removed. Products that already have orders are archived instead, so order history stays intact.`}
        confirmLabel="Delete"
        loading={busy}
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return
          setBusy(true)
          await run(() => sellerService.deleteProduct(deleting.id))
          setBusy(false)
          setDeleting(null)
        }}
      />
    </div>
  )
}
