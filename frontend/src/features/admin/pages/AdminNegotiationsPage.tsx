import { Handshake, Search } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { Alert, Badge, Button, EmptyState, Input, Pagination, Skeleton, Table, TableWrap, Tabs, Td, Th } from '@/components/ui'
import type { BadgeTone } from '@/components/ui/Badge'
import { useAsync } from '@/hooks/useAsync'
import { formatDate, formatPrice } from '@/utils/format'
import type { NegotiationStatus } from '@/features/negotiations/types'
import { adminService } from '../adminService'

type StatusTab = 'all' | NegotiationStatus

const tabs: { value: StatusTab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'expired', label: 'Expired' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'converted_to_order', label: 'Ordered' },
]

const tones: Record<NegotiationStatus, BadgeTone> = {
  active: 'brand',
  accepted: 'success',
  rejected: 'danger',
  expired: 'neutral',
  cancelled: 'neutral',
  converted_to_order: 'success',
}

/** Read-only monitor of every negotiation thread on the platform. */
export default function AdminNegotiationsPage() {
  const [tab, setTab] = useState<StatusTab>('all')
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)

  const { data, error, loading } = useAsync(
    () => adminService.negotiations({ status: tab === 'all' ? undefined : tab, q: query || undefined, page }),
    [tab, query, page],
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Negotiations</h1>
        <p className="mt-1 text-sm text-ink-muted">Monitor price discussions between customers and sellers. Conversations are read-only here.</p>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="overflow-x-auto">
          <Tabs label="Filter negotiations by status" value={tab} onChange={(value) => { setTab(value); setPage(1) }} items={tabs} />
        </div>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setQuery(search.trim()); setPage(1) }}>
          <Input
            aria-label="Search negotiations"
            placeholder="Product, store, customer or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 sm:w-72"
            trailing={<Search className="size-4 text-ink-subtle" aria-hidden />}
          />
          <Button type="submit" variant="secondary">Search</Button>
        </form>
      </div>

      {error && <Alert tone="danger">{error.message}</Alert>}

      {loading && !data ? (
        <Skeleton className="h-72 rounded-2xl" />
      ) : data?.data.length === 0 ? (
        <EmptyState
          icon={Handshake}
          title={query ? 'No negotiations match your search' : 'No negotiations yet'}
          message={query ? 'Try a different product, store, customer or email.' : 'Customer offers will appear here as soon as buyers start bargaining.'}
        />
      ) : (
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>Thread</Th>
                <Th>Customer</Th>
                <Th>Quantity</Th>
                <Th>Latest offer</Th>
                <Th>Status</Th>
                <Th>Last activity</Th>
                <Th><span className="sr-only">Actions</span></Th>
              </tr>
            </thead>
            <tbody>
              {data?.data.map((negotiation) => (
                <tr key={negotiation.id} className="hover:bg-canvas/40">
                  <Td>
                    <div className="flex items-center gap-2">
                      <span className="size-9 shrink-0 overflow-hidden rounded-lg bg-canvas">
                        {negotiation.product.image_url ? (
                          <img src={negotiation.product.image_url} alt="" className="size-full object-cover" />
                        ) : (
                          <span className="grid size-full place-items-center text-ink-subtle"><Handshake className="size-4" /></span>
                        )}
                      </span>
                      <span className="min-w-0">
                        <Link to={`/admin/negotiations/${negotiation.id}`} className="block truncate font-medium hover:text-brand-700">
                          {negotiation.product.name}
                        </Link>
                        <span className="block truncate text-xs text-ink-subtle">{negotiation.store?.name}</span>
                      </span>
                    </div>
                  </Td>
                  <Td>
                    <p className="font-medium">{negotiation.customer?.name ?? 'Customer'}</p>
                  </Td>
                  <Td className="text-ink-muted">{negotiation.quantity}</Td>
                  <Td>
                    {negotiation.latest_offer ? (
                      <>
                        <span className="font-semibold">{formatPrice(negotiation.latest_offer.amount)}</span>
                        <span className="block text-xs text-ink-subtle">{negotiation.latest_offer.status_label} · {negotiation.latest_offer.sender_role}</span>
                      </>
                    ) : '—'}
                  </Td>
                  <Td><Badge tone={tones[negotiation.status]}>{negotiation.status_label}</Badge></Td>
                  <Td className="whitespace-nowrap text-xs text-ink-muted">
                    {negotiation.last_activity_at ? formatDate(negotiation.last_activity_at) : '—'}
                    {negotiation.expires_at && <span className="block text-ink-subtle">expires {formatDate(negotiation.expires_at)}</span>}
                  </Td>
                  <Td className="text-right">
                    <Link to={`/admin/negotiations/${negotiation.id}`}><Button size="sm" variant="secondary">View</Button></Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      )}

      {data && <Pagination page={data.meta.current_page} lastPage={data.meta.last_page} onChange={setPage} />}
    </div>
  )
}
