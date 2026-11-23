import { AlertTriangle, ArrowLeft, CheckCircle2, MessageSquareText, RotateCcw, Star, XCircle } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Alert, Button, Card, CardBody, CardHeader, ConfirmDialog, EmptyState, Skeleton } from '@/components/ui'
import { ApiError } from '@/services/api/types'
import { toast } from '@/store/toastStore'
import { formatDate, formatPrice } from '@/utils/format'
import { CancelOrderModal } from '../components/CancelOrderModal'
import { OpenDisputeModal } from '../components/OpenDisputeModal'
import { OrderItems } from '../components/OrderItems'
import { AddressCard, PaymentCard, TotalsCard } from '../components/OrderSidebar'
import { DisputeStatusBadge, OrderStatusBadge } from '../components/OrderStatusBadge'
import { OrderTimeline } from '../components/OrderTimeline'
import { ReviewModal } from '../components/ReviewModal'
import { orderService } from '../orderService'
import type { DisputeReason, OrderDetail } from '../types'
import { useAsync } from '@/hooks/useAsync'

/** Customer view of one store order with every post-purchase action. */
export default function CustomerOrderDetailPage() {
  const { id } = useParams()
  const orderId = Number(id)
  const navigate = useNavigate()
  const { data, error, loading, reload } = useAsync(() => orderService.order(orderId), [orderId])

  const [cancelOpen, setCancelOpen] = useState(false)
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [disputeOpen, setDisputeOpen] = useState(false)
  const [reviewItem, setReviewItem] = useState<{ id: number; name: string } | null>(null)
  const [busy, setBusy] = useState(false)

  if (loading && !data) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-10 sm:px-6 lg:px-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <EmptyState
          icon={XCircle}
          title="Order unavailable"
          message={error?.status === 403 ? 'This order belongs to another account.' : (error?.message ?? 'We could not load this order.')}
          action={<Link to="/orders"><Button>Back to my orders</Button></Link>}
        />
      </div>
    )
  }

  const order = data
  const canCancel = ['pending', 'confirmed'].includes(order.status)
  const canConfirmReceipt = ['shipped', 'delivered'].includes(order.status) && !order.received_at
  const activeDispute = order.disputes.find((d) => ['open', 'under_review'].includes(d.status))
  const canOpenDispute = ['shipped', 'delivered', 'returned'].includes(order.status) && !activeDispute
  const canReview = ['delivered', 'returned'].includes(order.status)

  async function act(work: () => Promise<OrderDetail>, success: string) {
    setBusy(true)
    try {
      await work()
      toast.success(success)
      setCancelOpen(false)
      setReceiptOpen(false)
      reload()
    } catch (e) {
      toast.error(e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : 'The action could not be completed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <Link to="/orders" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> My orders
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Order {order.reference_number}</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {order.store?.name} · placed {order.created_at ? formatDate(order.created_at) : 'recently'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <OrderStatusBadge status={order.status} label={order.status_label} />
          {canCancel && (
            <Button variant="secondary" size="sm" onClick={() => setCancelOpen(true)}>Cancel order</Button>
          )}
          {canConfirmReceipt && (
            <Button size="sm" leftIcon={<CheckCircle2 className="size-4" />} onClick={() => setReceiptOpen(true)}>
              Confirm receipt
            </Button>
          )}
          {canOpenDispute && (
            <Button variant="secondary" size="sm" leftIcon={<AlertTriangle className="size-4" />} onClick={() => setDisputeOpen(true)}>
              Report a problem
            </Button>
          )}
        </div>
      </div>

      {order.status === 'cancelled' && (
        <Alert tone="danger" title="This order was cancelled" className="mt-5">
          {order.cancellation_reason ?? 'No reason was recorded.'}
        </Alert>
      )}
      {order.status === 'returned' && (
        <Alert tone="warning" title="This order was returned" className="mt-5">
          The stock was returned to the seller. Contact the store if you need another copy.
        </Alert>
      )}
      {activeDispute && (
        <Alert tone="info" title="A dispute is open for this order" className="mt-5" action={<Link to={`/account/disputes/${activeDispute.id}`}><Button size="sm" variant="secondary">Open dispute</Button></Link>}>
          <p>{activeDispute.reason_label} · {activeDispute.status_label}</p>
        </Alert>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <h2 className="font-semibold">Items from {order.store?.name}</h2>
              <span className="text-sm font-semibold">{formatPrice(order.subtotal)}</span>
            </CardHeader>
            <CardBody className="pt-3">
              <OrderItems items={order.items} />
              {canReview && (
                <div className="mt-4 space-y-2 border-t border-line pt-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-ink-subtle">Reviews</p>
                  {order.items.map((item) => (
                    <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="min-w-0 flex-1 truncate">{item.product_name}</span>
                      {item.reviewed ? (
                        <span className="inline-flex items-center gap-1 text-xs text-success-600"><CheckCircle2 className="size-3.5" aria-hidden /> Reviewed</span>
                      ) : (
                        <Button size="sm" variant="ghost" leftIcon={<Star className="size-4" />} onClick={() => setReviewItem({ id: item.id, name: item.product_name })}>
                          Write a review
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          {order.customer_notes && (
            <Card>
              <CardBody>
                <h2 className="font-semibold">Delivery instructions</h2>
                <p className="mt-1 text-sm text-ink-muted">{order.customer_notes}</p>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader>
              <h2 className="font-semibold">Progress</h2>
            </CardHeader>
            <CardBody className="pt-3">
              <OrderTimeline entries={order.status_history} />
              {order.received_at && (
                <p className="mt-4 rounded-xl bg-success-50 p-3 text-xs text-emerald-800">
                  You confirmed receipt on {formatDate(order.received_at)}.
                </p>
              )}
            </CardBody>
          </Card>

          {order.disputes.length > 0 && (
            <Card>
              <CardHeader>
                <h2 className="inline-flex items-center gap-2 font-semibold">
                  <MessageSquareText className="size-4 text-brand-600" aria-hidden /> Disputes
                </h2>
              </CardHeader>
              <CardBody className="space-y-2 pt-3">
                {order.disputes.map((dispute) => (
                  <Link
                    key={dispute.id}
                    to={`/account/disputes/${dispute.id}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-line p-3 text-sm hover:border-brand-200"
                  >
                    <span className="min-w-0">
                      <span className="block font-medium">{dispute.reason_label}</span>
                      <span className="text-xs text-ink-subtle">{dispute.created_at ? formatDate(dispute.created_at) : ''}</span>
                    </span>
                    <DisputeStatusBadge status={dispute.status} label={dispute.status_label} />
                  </Link>
                ))}
              </CardBody>
            </Card>
          )}
        </div>

        <aside className="space-y-4">
          <AddressCard address={order.address} />
          <PaymentCard payment={order.payment} />
          <TotalsCard subtotal={order.subtotal} shipping={order.shipping_cost} discount={order.discount} total={order.total_amount} />
          <Card>
            <CardBody className="space-y-2 text-sm">
              <p className="font-semibold">Need help?</p>
              <p className="text-ink-muted">Message the store from a dispute, or contact support if the parcel never arrives.</p>
              <Link to={`/stores/${order.store?.slug ?? ''}`} className="text-sm font-medium text-brand-600 hover:text-brand-700">
                Visit the store
              </Link>
              {order.status === 'returned' && (
                <p className="inline-flex items-center gap-1.5 text-xs text-ink-subtle"><RotateCcw className="size-3.5" aria-hidden /> Return completed</p>
              )}
            </CardBody>
          </Card>
        </aside>
      </div>

      {cancelOpen && (
        <CancelOrderModal
          open
          orderReference={order.reference_number}
          loading={busy}
          onClose={() => setCancelOpen(false)}
          onConfirm={(reason) => act(() => orderService.cancel(order.id, reason), 'Order cancelled.')}
        />
      )}

      <ConfirmDialog
        open={receiptOpen}
        title="Confirm receipt?"
        message="Confirm only after the parcel is in your hands. This completes the order and lets you review the products."
        confirmLabel="Yes, I received it"
        tone="primary"
        loading={busy}
        onCancel={() => setReceiptOpen(false)}
        onConfirm={() => void act(() => orderService.confirmReceipt(order.id), 'Receipt confirmed. Thank you!')}
      />

      {disputeOpen && (
        <OpenDisputeModal
          open
          orderReference={order.reference_number}
          loading={busy}
          onClose={() => setDisputeOpen(false)}
          onSubmit={async ({ reason, description }: { reason: DisputeReason; description: string }) => {
            setBusy(true)
            try {
              const dispute = await orderService.openDispute(order.id, { reason, description })
              toast.success('Dispute opened. The seller has been notified.')
              setDisputeOpen(false)
              navigate(`/disputes/${dispute.id}`)
            } catch (e) {
              toast.error(e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : 'Could not open the dispute.')
            } finally {
              setBusy(false)
            }
          }}
        />
      )}

      {reviewItem && (
        <ReviewModal
          open
          productName={reviewItem.name}
          loading={busy}
          onClose={() => setReviewItem(null)}
          onSubmit={async ({ rating, comment }) => {
            setBusy(true)
            try {
              const review = await orderService.review(order.id, { order_item_id: reviewItem.id, rating, comment })
              toast.success(review.status === 'approved' ? 'Thank you for your review.' : 'Thank you! Your review will appear after moderation.')
              setReviewItem(null)
              reload()
            } catch (e) {
              toast.error(e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : 'Could not submit the review.')
            } finally {
              setBusy(false)
            }
          }}
        />
      )}
    </div>
  )
}
