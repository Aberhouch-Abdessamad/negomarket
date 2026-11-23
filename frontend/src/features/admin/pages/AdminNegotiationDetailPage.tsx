import { ArrowLeft, Handshake, MessageSquareText } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { Alert, Badge, Card, CardBody, CardHeader, EmptyState, Skeleton } from '@/components/ui'
import type { BadgeTone } from '@/components/ui/Badge'
import { useAsync } from '@/hooks/useAsync'
import { formatDate, formatPrice } from '@/utils/format'
import type { NegotiationStatus, OfferStatus } from '@/features/negotiations/types'
import { adminService } from '../adminService'

const negotiationTones: Record<NegotiationStatus, BadgeTone> = {
  active: 'brand',
  accepted: 'success',
  rejected: 'danger',
  expired: 'neutral',
  cancelled: 'neutral',
  converted_to_order: 'success',
}

const offerTones: Record<OfferStatus, BadgeTone> = {
  pending: 'warning',
  accepted: 'success',
  rejected: 'danger',
  countered: 'brand',
  expired: 'neutral',
  withdrawn: 'neutral',
}

/** Read-only transcript of one negotiation, including every offer and message. */
export default function AdminNegotiationDetailPage() {
  const { id } = useParams()
  const negotiationId = Number(id)
  const { data, error, loading } = useAsync(() => adminService.negotiation(negotiationId), [negotiationId])

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <EmptyState
        icon={Handshake}
        title="Negotiation unavailable"
        message={error?.message ?? 'We could not load this negotiation.'}
        action={<Link to="/admin/negotiations"><span className="text-sm font-medium text-brand-700">Back to negotiations</span></Link>}
      />
    )
  }

  const negotiation = data
  const messages = negotiation.messages ?? []

  return (
    <div className="space-y-6">
      <div>
        <Link to="/admin/negotiations" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden /> All negotiations
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">{negotiation.product?.name}</h1>
            <p className="mt-1 text-sm text-ink-muted">
              {negotiation.store?.name} · {negotiation.customer?.name} · {negotiation.quantity} {negotiation.quantity === 1 ? 'unit' : 'units'}
            </p>
          </div>
          <Badge tone={negotiationTones[negotiation.status]}>{negotiation.status_label}</Badge>
        </div>
      </div>

      <Alert tone="info" title="Read-only monitoring">
        Administrators can inspect negotiations but cannot send offers or messages from this screen.
      </Alert>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <h2 className="font-semibold">Offer history</h2>
              <span className="text-sm text-ink-muted">{negotiation.offers.length} {negotiation.offers.length === 1 ? 'offer' : 'offers'}</span>
            </CardHeader>
            <CardBody className="pt-3">
              {negotiation.offers.length === 0 ? (
                <p className="text-sm text-ink-muted">No offers recorded.</p>
              ) : (
                <ol className="space-y-3">
                  {negotiation.offers.map((offer) => (
                    <li key={offer.id} className="rounded-xl border border-line p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="flex items-center gap-2">
                          <span className="text-base font-semibold">{formatPrice(offer.amount)}</span>
                          <Badge tone={offerTones[offer.status]}>{offer.status_label}</Badge>
                        </span>
                        <span className="text-xs text-ink-subtle">{offer.created_at ? formatDate(offer.created_at) : ''}</span>
                      </div>
                      <p className="mt-1 text-xs text-ink-muted">
                        From {offer.sender_role} · {offer.sender?.name ?? `user #${offer.sender_id}`}
                        {offer.expires_at ? ` · expires ${formatDate(offer.expires_at)}` : ''}
                        {offer.is_expired ? ' · expired' : ''}
                      </p>
                      {offer.message && <p className="mt-2 rounded-lg bg-canvas p-2 text-sm text-ink-muted">{offer.message}</p>}
                    </li>
                  ))}
                </ol>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="inline-flex items-center gap-2 font-semibold">
                <MessageSquareText className="size-4 text-brand-600" aria-hidden /> Conversation
              </h2>
              <span className="text-sm text-ink-muted">{messages.length} {messages.length === 1 ? 'message' : 'messages'}</span>
            </CardHeader>
            <CardBody className="space-y-3 pt-3">
              {messages.length === 0 ? (
                <p className="text-sm text-ink-muted">No chat messages recorded.</p>
              ) : (
                messages.map((message) => (
                  <div key={message.id} className="rounded-xl border border-line p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-subtle">
                      <span className="font-medium text-ink">{message.sender?.name ?? `user #${message.sender_id}`}</span>
                      <span>{message.created_at ? formatDate(message.created_at) : ''}</span>
                    </div>
                    <p className="mt-1.5 whitespace-pre-line text-sm text-ink-muted">{message.body}</p>
                  </div>
                ))
              )}
            </CardBody>
          </Card>
        </div>

        <aside className="space-y-4">
          <Card>
            <CardHeader><h2 className="font-semibold">Thread</h2></CardHeader>
            <CardBody className="space-y-2 pt-3 text-sm">
              <Row label="Status" value={negotiation.status_label} />
              <Row label="Quantity" value={String(negotiation.quantity)} />
              <Row label="Listed price" value={negotiation.product ? formatPrice(negotiation.product.price) : '—'} />
              {negotiation.variant && <Row label="Variant" value={negotiation.variant.sku} />}
              <Row label="Created" value={negotiation.created_at ? formatDate(negotiation.created_at) : '—'} />
              <Row label="Last activity" value={negotiation.last_activity_at ? formatDate(negotiation.last_activity_at) : '—'} />
              {negotiation.expires_at && <Row label="Expires" value={formatDate(negotiation.expires_at)} />}
              {negotiation.closed_at && <Row label="Closed" value={formatDate(negotiation.closed_at)} />}
            </CardBody>
          </Card>

          <Card>
            <CardHeader><h2 className="font-semibold">Parties</h2></CardHeader>
            <CardBody className="space-y-3 pt-3 text-sm">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">Customer</p>
                <p className="mt-0.5 font-medium">{negotiation.customer?.name ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">Store</p>
                <p className="mt-0.5 font-medium">{negotiation.store?.name ?? '—'}</p>
              </div>
            </CardBody>
          </Card>

          {negotiation.accepted_offer && (
            <Card>
              <CardHeader><h2 className="font-semibold">Accepted offer</h2></CardHeader>
              <CardBody className="pt-3 text-sm">
                <p className="text-lg font-semibold">{formatPrice(negotiation.accepted_offer.amount)}</p>
                <p className="text-xs text-ink-subtle">{negotiation.accepted_offer.created_at ? formatDate(negotiation.accepted_offer.created_at) : ''}</p>
                {negotiation.converted_order_id && (
                  <Link to={`/admin/orders/${negotiation.converted_order_id}`} className="mt-2 inline-block text-sm font-medium text-brand-700 hover:underline">
                    View converted order
                  </Link>
                )}
              </CardBody>
            </Card>
          )}
        </aside>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex items-center justify-between gap-3">
      <span className="text-ink-muted">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </p>
  )
}
