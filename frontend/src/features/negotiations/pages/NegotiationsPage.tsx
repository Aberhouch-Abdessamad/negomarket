import { Handshake, MessageSquareText, Search } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation } from 'react-router'
import { Badge, Button, EmptyState, Input, Pagination, Skeleton, Tabs } from '@/components/ui'
import type { BadgeTone } from '@/components/ui/Badge'
import { useAsync } from '@/hooks/useAsync'
import { useAuthStore } from '@/store/authStore'
import { formatPrice, pluralize } from '@/utils/format'
import { negotiationService, type NegotiationFilters } from '../negotiationService'
import type { NegotiationStatus, NegotiationSummary } from '../types'

const statusTone: Record<NegotiationStatus, BadgeTone> = {
  active: 'brand',
  accepted: 'success',
  converted_to_order: 'success',
  rejected: 'danger',
  expired: 'neutral',
  cancelled: 'neutral',
}

const statusTabs = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'accepted', label: 'Accepted' },
  { id: 'closed', label: 'Closed' },
] as const

type StatusTab = (typeof statusTabs)[number]['id']

function statusFilter(tab: StatusTab): NegotiationStatus | undefined {
  if (tab === 'active') return 'active'
  if (tab === 'accepted') return 'accepted'
  return undefined
}

/** Negotiation inbox used by customers and sellers (same API, different role tab). */
export default function NegotiationsPage() {
  const user = useAuthStore((s) => s.user)
  const pathname = useLocation().pathname
  const sellerContext = pathname.startsWith('/seller')
  const [role, setRole] = useState<'customer' | 'seller'>(sellerContext ? 'seller' : 'customer')
  const [tab, setTab] = useState<StatusTab>('all')
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [page, setPage] = useState(1)

  const filters: NegotiationFilters = {
    role,
    status: statusFilter(tab),
    q: appliedSearch || undefined,
    page,
  }

  const { data, loading, error } = useAsync(() => negotiationService.list(filters), [role, tab, appliedSearch, page])

  const isSeller = Boolean(user?.is_seller)
  const basePath = sellerContext ? '/seller/negotiations' : '/negotiations'
  const closed = data?.data.filter((n) => !statusFilter(tab) && !['active', 'accepted'].includes(n.status))

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Negotiations</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {role === 'seller'
              ? 'Respond to offers, counter, and chat with buyers.'
              : 'Track your offers and agreed prices with sellers.'}
          </p>
        </div>
        <Link to="/products?negotiable=1" className="text-sm font-medium text-brand-600 hover:text-brand-700">
          Browse products open to offers
        </Link>
      </div>

      {isSeller && (
        <div className="mt-6">
          <Tabs
            label="Negotiation perspective"
            items={[
              { value: 'customer', label: 'Buying' },
              { value: 'seller', label: 'Selling' },
            ]}
            value={role}
            onChange={(value) => {
              setRole(value)
              setPage(1)
            }}
          />
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs label="Negotiation status" items={statusTabs.map((t) => ({ value: t.id, label: t.label }))} value={tab} onChange={(value) => { setTab(value); setPage(1) }} />
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            setAppliedSearch(search.trim())
            setPage(1)
          }}
        >
          <Input
            aria-label="Search negotiations by product"
            placeholder="Search by product…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 sm:w-64"
            trailing={<Search className="size-4 text-ink-subtle" aria-hidden />}
          />
          <Button type="submit" variant="secondary">Search</Button>
        </form>
      </div>

      <div className="mt-6 space-y-3">
        {loading && !data && [1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}

        {error && <p role="alert" className="rounded-xl bg-danger-50 p-4 text-sm text-danger-600">{error.message}</p>}

        {!loading && data?.data.length === 0 && (
          <EmptyState
            icon={Handshake}
            title={role === 'seller' ? 'No offers yet' : 'No negotiations yet'}
            message={
              role === 'seller'
                ? 'When a customer makes an offer on one of your negotiable products it will appear here.'
                : 'Find a product marked “Seller accepts offers” and send your first price offer.'
            }
            action={<Link to="/products?negotiable=1"><Button>Browse negotiable products</Button></Link>}
          />
        )}

        {data?.data.map((negotiation) => (
          <NegotiationRow key={negotiation.id} negotiation={negotiation} href={`${basePath}/${negotiation.id}`} />
        ))}
      </div>

      {closed && closed.length > 0 && tab === 'all' && (
        <p className="mt-4 text-xs text-ink-subtle">
          {pluralize(closed.length, 'closed negotiation')} shown in this page. Use the Closed tab to focus on them.
        </p>
      )}

      {data && <div className="mt-6"><Pagination page={data.meta.current_page} lastPage={data.meta.last_page} onChange={setPage} /></div>}
    </div>
  )
}

function NegotiationRow({ negotiation, href }: { negotiation: NegotiationSummary; href: string }) {
  const latest = negotiation.accepted_offer ?? negotiation.latest_offer
  const counterpart = negotiation.role === 'seller' ? negotiation.customer : negotiation.store

  return (
    <Link to={href} className="block rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-brand-200 sm:p-5">
      <div className="flex gap-4">
        <span className="size-16 shrink-0 overflow-hidden rounded-xl bg-canvas sm:size-20">
          {negotiation.product.image_url ? (
            <img src={negotiation.product.image_url} alt="" className="size-full object-cover" />
          ) : (
            <span className="grid size-full place-items-center text-ink-subtle"><Handshake className="size-6" /></span>
          )}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-semibold">{negotiation.product.name}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-subtle">
                <span>{negotiation.role === 'seller' ? 'Buyer' : 'Seller'}: {counterpart.name}</span>
                <span>·</span>
                <span>Qty {negotiation.quantity}</span>
                {negotiation.variant && <><span>·</span><span>{Object.values(negotiation.variant.attributes).join(' / ')}</span></>}
              </p>
            </div>
            <Badge tone={statusTone[negotiation.status]}>{negotiation.status_label}</Badge>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            {latest ? (
              <span>
                <span className="text-ink-muted">{latest.sender_role === 'seller' ? 'Seller' : 'Customer'} offer </span>
                <span className="font-semibold">{formatPrice(latest.amount)}</span>
                <span className="text-ink-subtle"> · {latest.status_label}</span>
              </span>
            ) : (
              <span className="text-ink-subtle">No offers yet</span>
            )}
            {negotiation.unread_count > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                <MessageSquareText className="size-3" aria-hidden /> {negotiation.unread_count} unread
              </span>
            )}
          </div>

          <p className="mt-1 text-xs text-ink-subtle">
            Updated {formatRelative(negotiation.last_activity_at ?? negotiation.created_at)}
            {negotiation.status === 'active' && negotiation.expires_at && ` · current offer expires ${formatRelative(negotiation.expires_at)}`}
            {negotiation.status === 'accepted' && negotiation.expires_at && ` · checkout by ${formatRelative(negotiation.expires_at)}`}
          </p>
        </div>
      </div>
    </Link>
  )
}

function formatRelative(iso: string | null): string {
  if (!iso) return 'recently'
  const diff = new Date(iso).getTime() - Date.now()
  const abs = Math.abs(diff)
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  if (abs < 60_000) return formatter.format(Math.round(diff / 1000), 'second')
  if (abs < 3_600_000) return formatter.format(Math.round(diff / 60_000), 'minute')
  if (abs < 86_400_000) return formatter.format(Math.round(diff / 3_600_000), 'hour')
  if (abs < 2_592_000_000) return formatter.format(Math.round(diff / 86_400_000), 'day')
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
