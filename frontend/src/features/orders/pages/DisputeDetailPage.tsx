import { ArrowLeft, PackageSearch, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { Alert, Button, Card, CardBody, CardHeader, EmptyState, Skeleton } from '@/components/ui'
import { useAsync } from '@/hooks/useAsync'
import { useAuthStore } from '@/store/authStore'
import { formatPrice } from '@/utils/format'
import { DisputeThread } from '../components/DisputeThread'
import { OrderStatusBadge } from '../components/OrderStatusBadge'
import { orderService } from '../orderService'
import type { Dispute } from '../types'

/** One dispute conversation. Visibility is enforced by the API policy. */
export default function DisputeDetailPage() {
  const { id } = useParams()
  const disputeId = Number(id)
  const pathname = useLocation().pathname
  const user = useAuthStore((s) => s.user)
  const { data, error, loading } = useAsync(() => orderService.dispute(disputeId), [disputeId])
  const [live, setLive] = useState<Dispute | null>(null)

  useEffect(() => {
    setLive(null)
  }, [data])

  const inSeller = pathname.startsWith('/seller')
  const inAdmin = pathname.startsWith('/admin')
  const base = inSeller ? '/seller/disputes' : inAdmin ? '/admin/disputes' : '/account/disputes'

  if (loading && !data) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 px-4 py-10 sm:px-6 lg:px-8">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <EmptyState
          icon={ShieldCheck}
          title="Dispute unavailable"
          message={error?.status === 403 ? 'This dispute belongs to another account.' : (error?.message ?? 'We could not load this dispute.')}
          action={<Link to={base}><Button>Back to disputes</Button></Link>}
        />
      </div>
    )
  }

  const dispute = live ?? data
  const isOpener = dispute.opened_by?.id === user?.id
  const isStoreOwner = Boolean(user?.is_seller && user.store && dispute.order?.store?.id === user.store.id)
  const canManage = Boolean(user?.is_admin || user?.permissions.includes('disputes.manage'))
  const canReply = (isOpener || isStoreOwner) && ['open', 'under_review'].includes(dispute.status)
  const orderHref = dispute.order
    ? inSeller
      ? `/seller/orders/${dispute.order.id}`
      : inAdmin
        ? null
        : `/orders/${dispute.order.id}`
    : null

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <Link to={base} className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> All disputes
      </Link>

      <h1 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">Dispute #{dispute.id}</h1>
      <p className="mt-1 text-sm text-ink-muted">{dispute.reason_label}</p>

      {canManage && (
        <Alert tone="info" title="Support view" className="mt-5">
          You can read every dispute and record a decision at the bottom of the conversation.
        </Alert>
      )}

      {dispute.order && (
        <Card className="mt-5">
          <CardHeader>
            <h2 className="inline-flex items-center gap-2 font-semibold">
              <PackageSearch className="size-4 text-brand-600" aria-hidden /> Order in question
            </h2>
            <OrderStatusBadge status={dispute.order.status} label={dispute.order.status_label} />
          </CardHeader>
          <CardBody className="flex flex-wrap items-center justify-between gap-3 pt-3 text-sm">
            <div>
              <p className="font-medium">{dispute.order.reference_number}</p>
              <p className="text-xs text-ink-subtle">{dispute.order.store?.name}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-semibold">{formatPrice(dispute.order.total_amount)}</span>
              {orderHref && <Link to={orderHref}><Button size="sm" variant="secondary">View order</Button></Link>}
            </div>
          </CardBody>
        </Card>
      )}

      <Card className="mt-5">
        <CardBody>
          <DisputeThread
            dispute={dispute}
            currentUserId={user?.id ?? 0}
            canReply={canReply}
            canResolve={canManage}
            onChanged={setLive}
          />
        </CardBody>
      </Card>
    </div>
  )
}
