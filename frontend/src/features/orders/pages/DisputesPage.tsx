import { MessageSquareText, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation } from 'react-router'
import { Card, CardBody, EmptyState, Pagination, Skeleton, Tabs } from '@/components/ui'
import { useAsync } from '@/hooks/useAsync'
import { formatDate, formatPrice } from '@/utils/format'
import { orderService } from '../orderService'
import type { DisputeStatus } from '../types'
import { DisputeStatusBadge } from '../components/OrderStatusBadge'

type StatusTab = 'all' | DisputeStatus

const tabs: { value: StatusTab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'under_review', label: 'Under review' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'closed', label: 'Closed' },
]

/** Shared dispute inbox for customers, sellers and support. */
export default function DisputesPage() {
  const pathname = useLocation().pathname
  const inSeller = pathname.startsWith('/seller')
  const inAdmin = pathname.startsWith('/admin')
  const base = inSeller ? '/seller/disputes' : inAdmin ? '/admin/disputes' : '/account/disputes'

  const [tab, setTab] = useState<StatusTab>('all')
  const [page, setPage] = useState(1)
  const { data, error, loading } = useAsync(
    () => orderService.disputes({ status: tab === 'all' ? undefined : tab, page }),
    [tab, page],
  )

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Disputes</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {inAdmin
            ? 'Review claims from buyers and sellers, and record a clear decision.'
            : 'Problems reported on a delivered or shipped order, with the full conversation.'}
        </p>
      </div>

      <div className="mt-6 overflow-x-auto">
        <Tabs
          label="Filter disputes by status"
          value={tab}
          onChange={(value) => {
            setTab(value)
            setPage(1)
          }}
          items={tabs}
        />
      </div>

      <div className="mt-6 space-y-3">
        {loading && !data && [1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        {error && <p role="alert" className="rounded-xl bg-danger-50 p-4 text-sm text-danger-600">{error.message}</p>}

        {!loading && data?.data.length === 0 && (
          <EmptyState
            icon={ShieldCheck}
            title="No disputes here"
            message={inAdmin ? 'Nothing needs a support decision right now.' : 'If something goes wrong with a delivered order, open a dispute from the order page.'}
          />
        )}

        {data?.data.map((dispute) => {
          const last = dispute.messages[dispute.messages.length - 1]
          return (
            <Link key={dispute.id} to={`${base}/${dispute.id}`} className="block">
              <Card className="transition-colors hover:border-brand-200">
                <CardBody className="space-y-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{dispute.reason_label}</p>
                      <p className="mt-0.5 text-xs text-ink-subtle">
                        {dispute.order?.reference_number ? `Order ${dispute.order.reference_number}` : `Dispute #${dispute.id}`}
                        {dispute.order?.store?.name ? ` · ${dispute.order.store.name}` : ''}
                        {dispute.created_at ? ` · ${formatDate(dispute.created_at)}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {dispute.order && <span className="text-sm font-semibold">{formatPrice(dispute.order.total_amount)}</span>}
                      <DisputeStatusBadge status={dispute.status} label={dispute.status_label} />
                    </div>
                  </div>
                  {last && (
                    <p className="flex items-start gap-1.5 text-sm text-ink-muted">
                      <MessageSquareText className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                      <span className="line-clamp-2">{last.sender?.name ? `${last.sender.name}: ` : ''}{last.message}</span>
                    </p>
                  )}
                  {dispute.resolution && <p className="text-xs text-success-600">Resolution: {dispute.resolution}</p>}
                </CardBody>
              </Card>
            </Link>
          )
        })}
      </div>

      {data && <div className="mt-6"><Pagination page={data.meta.current_page} lastPage={data.meta.last_page} onChange={setPage} /></div>}
    </div>
  )
}
