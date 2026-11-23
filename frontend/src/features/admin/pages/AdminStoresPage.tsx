import { ExternalLink, Search, Store as StoreIcon } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { Alert, Badge, Button, ConfirmDialog, EmptyState, Input, Pagination, Skeleton, Table, TableWrap, Tabs, Td, Th } from '@/components/ui'
import { useAsync } from '@/hooks/useAsync'
import { ApiError } from '@/services/api/types'
import { toast } from '@/store/toastStore'
import { formatDate } from '@/utils/format'
import { adminService } from '../adminService'
import { StoreStatusBadge } from '../components/AdminBadges'
import type { AdminStore, AdminStoreStatus } from '../types'

type StatusTab = '' | AdminStoreStatus

const tabs: { value: StatusTab; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'closed', label: 'Closed' },
]

interface PendingChange {
  store: AdminStore
  status: AdminStoreStatus
}

export default function AdminStoresPage() {
  const [tab, setTab] = useState<StatusTab>('')
  const [search, setSearch] = useState('')
  const [applied, setApplied] = useState('')
  const [page, setPage] = useState(1)
  const [pending, setPending] = useState<PendingChange | null>(null)
  const [busy, setBusy] = useState(false)

  const { data, error, loading, reload } = useAsync(
    () => adminService.stores({ status: tab || undefined, q: applied || undefined, page }),
    [tab, applied, page],
  )

  async function change() {
    if (!pending) return
    setBusy(true)
    try {
      await adminService.updateStoreStatus(pending.store.id, pending.status)
      toast.success(`${pending.store.name} is now ${pending.status}.`)
      setPending(null)
      reload()
    } catch (e) {
      toast.error(e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : 'Could not update the store.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Stores</h1>
        <p className="mt-1 text-sm text-ink-muted">Approve, suspend and close seller storefronts.</p>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <Tabs label="Store status" value={tab} onChange={(value) => { setTab(value); setPage(1) }} items={tabs} />
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setApplied(search.trim()); setPage(1) }}>
          <Input
            aria-label="Search stores"
            placeholder="Store name, owner or city…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 sm:w-64"
            trailing={<Search className="size-4 text-ink-subtle" aria-hidden />}
          />
          <Button type="submit" variant="secondary">Search</Button>
        </form>
      </div>

      {error && <Alert tone="danger">{error.message}</Alert>}

      {loading && !data ? (
        <Skeleton className="h-72 rounded-2xl" />
      ) : data?.data.length === 0 ? (
        <EmptyState icon={StoreIcon} title="No stores found" message="Try a different status or search term." />
      ) : (
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>Store</Th>
                <Th>Owner</Th>
                <Th>Location</Th>
                <Th>Catalog</Th>
                <Th>Rating</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {data?.data.map((store) => (
                <tr key={store.id} className="hover:bg-canvas/40">
                  <Td>
                    <div className="flex items-center gap-2">
                      <span className="size-9 shrink-0 overflow-hidden rounded-lg bg-canvas">
                        {store.logo_url ? <img src={store.logo_url} alt="" className="size-full object-cover" /> : <span className="grid size-full place-items-center text-ink-subtle"><StoreIcon className="size-4" /></span>}
                      </span>
                      <span>
                        <Link to={`/stores/${store.slug}`} className="inline-flex items-center gap-1 font-medium hover:text-brand-700">
                          {store.name} <ExternalLink className="size-3 text-ink-subtle" aria-hidden />
                        </Link>
                        <span className="block text-xs text-ink-subtle">Since {store.created_at ? formatDate(store.created_at) : '—'}</span>
                      </span>
                    </div>
                  </Td>
                  <Td>
                    <span className="block">{store.owner?.name ?? '—'}</span>
                    <span className="block text-xs text-ink-subtle">{store.owner?.email}</span>
                  </Td>
                  <Td>{store.city ?? '—'}</Td>
                  <Td className="text-xs text-ink-muted">{store.products_count ?? 0} products · {store.orders_count ?? 0} orders</Td>
                  <Td>{store.rating_count > 0 ? <><Badge tone="warning">{store.rating_avg.toFixed(1)} ★</Badge> <span className="text-xs text-ink-subtle">({store.rating_count})</span></> : '—'}</Td>
                  <Td><StoreStatusBadge status={store.status} label={store.status_label} /></Td>
                  <Td className="text-right">
                    <div className="inline-flex flex-wrap justify-end gap-1.5">
                      {store.status !== 'active' && (
                        <Button size="sm" onClick={() => setPending({ store, status: 'active' })}>Activate</Button>
                      )}
                      {store.status === 'active' && (
                        <Button size="sm" variant="danger" onClick={() => setPending({ store, status: 'suspended' })}>Suspend</Button>
                      )}
                      {store.status !== 'closed' && (
                        <Button size="sm" variant="secondary" onClick={() => setPending({ store, status: 'closed' })}>Close</Button>
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      )}

      {data && <Pagination page={data.meta.current_page} lastPage={data.meta.last_page} onChange={setPage} />}

      <ConfirmDialog
        open={pending !== null}
        title={pending ? `${actionLabel(pending.status)} ${pending.store.name}?` : 'Change store status'}
        message={
          pending?.status === 'active'
            ? 'The storefront becomes publicly visible and the owner can manage products again.'
            : pending?.status === 'suspended'
              ? 'The storefront is hidden from buyers until an administrator reactivates it.'
              : 'Closing the store hides it permanently from the marketplace. The owner keeps their account and order history.'
        }
        confirmLabel={pending ? actionLabel(pending.status) : 'Confirm'}
        tone={pending?.status === 'active' ? 'primary' : 'danger'}
        loading={busy}
        onCancel={() => setPending(null)}
        onConfirm={() => void change()}
      />
    </div>
  )
}

function actionLabel(status: AdminStoreStatus): string {
  return status === 'active' ? 'Activate' : status === 'suspended' ? 'Suspend' : 'Close'
}
