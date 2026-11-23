import { AlertTriangle, ArrowLeft, Banknote, CheckCircle2, Mail, MessageSquareText, Package, Phone, RotateCcw, Truck, UserRound } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { Alert, Button, Card, CardBody, CardHeader, ConfirmDialog, EmptyState, Skeleton } from '@/components/ui'
import { ApiError } from '@/services/api/types'
import { toast } from '@/store/toastStore'
import { formatDate, formatPrice } from '@/utils/format'
import { CancelOrderModal } from '../components/CancelOrderModal'
import { OrderItems } from '../components/OrderItems'
import { AddressCard, PaymentCard, TotalsCard } from '../components/OrderSidebar'
import { DisputeStatusBadge, OrderStatusBadge } from '../components/OrderStatusBadge'
import { OrderTimeline } from '../components/OrderTimeline'
import { orderService } from '../orderService'
import type { OrderDetail, OrderStatus } from '../types'
import { useAsync } from '@/hooks/useAsync'

interface PendingAction {
  status: OrderStatus
  label: string
  message: string
}

const NEXT_ACTIONS: Partial<Record<string, { status: OrderStatus; label: string; icon: LucideIcon }[]>> = {
  pending: [{ status: 'confirmed', label: 'Confirm order', icon: CheckCircle2 }],
  confirmed: [{ status: 'processing', label: 'Start processing', icon: Package }],
  processing: [{ status: 'shipped', label: 'Mark as shipped', icon: Truck }],
  shipped: [
    { status: 'delivered', label: 'Mark as delivered', icon: CheckCircle2 },
    { status: 'returned', label: 'Mark as returned', icon: RotateCcw },
  ],
  delivered: [{ status: 'returned', label: 'Mark as returned', icon: RotateCcw }],
}

/** Seller fulfilment screen: one order, one store, with COD collection. */
export default function SellerOrderDetailPage() {
  const { id } = useParams()
  const orderId = Number(id)
  const { data, error, loading, reload } = useAsync(() => orderService.sellerOrder(orderId), [orderId])

  const [cancelOpen, setCancelOpen] = useState(false)
  const [collectOpen, setCollectOpen] = useState(false)
  const [pending, setPending] = useState<PendingAction | null>(null)
  const [busy, setBusy] = useState(false)

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
        icon={AlertTriangle}
        title="Order unavailable"
        message={error?.status === 403 ? 'This order belongs to another store.' : (error?.message ?? 'We could not load this order.')}
        action={<Link to="/seller/orders"><Button>Back to orders</Button></Link>}
      />
    )
  }

  const order = data
  const nextActions = NEXT_ACTIONS[order.status] ?? []
  const canCancel = ['pending', 'confirmed', 'processing'].includes(order.status)
  const canCollect = order.status === 'delivered' && order.payment !== null && order.payment.status !== 'collected'
  const activeDispute = order.disputes.find((d) => ['open', 'under_review'].includes(d.status))

  async function act(work: () => Promise<OrderDetail>, success: string) {
    setBusy(true)
    try {
      await work()
      toast.success(success)
      setPending(null)
      setCancelOpen(false)
      setCollectOpen(false)
      reload()
    } catch (e) {
      toast.error(e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : 'The action could not be completed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/seller/orders" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden /> All orders
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">{order.reference_number}</h1>
            <p className="mt-1 text-sm text-ink-muted">
              {order.customer?.name} · {order.created_at ? formatDate(order.created_at) : 'recently'} · {formatPrice(order.total_amount)}
            </p>
          </div>
          <OrderStatusBadge status={order.status} label={order.status_label} />
        </div>
      </div>

      {order.status === 'cancelled' && (
        <Alert tone="danger" title="Order cancelled">{order.cancellation_reason ?? 'No reason was recorded.'}</Alert>
      )}
      {activeDispute && (
        <Alert
          tone="warning"
          title="The customer opened a dispute"
          action={<Link to={`/seller/disputes/${activeDispute.id}`}><Button size="sm" variant="secondary">Open dispute</Button></Link>}
        >
          <p>{activeDispute.reason_label} · {activeDispute.status_label}</p>
        </Alert>
      )}

      <Card>
        <CardBody className="flex flex-wrap items-center gap-2">
          {nextActions.map(({ status, label, icon: Icon }) => (
            <Button
              key={status}
              size="sm"
              variant={status === 'returned' ? 'secondary' : 'primary'}
              leftIcon={<Icon className="size-4" />}
              onClick={() =>
                setPending({
                  status,
                  label,
                  message:
                    status === 'returned'
                      ? 'This restores the sold stock to your inventory. Only mark returned after the parcel is back.'
                      : status === 'delivered'
                        ? 'Mark delivered only after the parcel reached the customer. Then you can record the cash collection.'
                        : `Change the status to ${status}. The customer is notified.`,
                })
              }
            >
              {label}
            </Button>
          ))}
          {canCollect && (
            <Button size="sm" variant="secondary" leftIcon={<Banknote className="size-4" />} onClick={() => setCollectOpen(true)}>
              Record cash collected
            </Button>
          )}
          {canCancel && (
            <Button size="sm" variant="ghost" onClick={() => setCancelOpen(true)}>Cancel order</Button>
          )}
          {!canCancel && nextActions.length === 0 && !canCollect && order.status !== 'cancelled' && (
            <p className="text-sm text-ink-muted">No further action is needed for this order.</p>
          )}
        </CardBody>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <h2 className="font-semibold">Items to prepare</h2>
              <span className="text-sm font-semibold">{formatPrice(order.subtotal)}</span>
            </CardHeader>
            <CardBody className="pt-3">
              <OrderItems items={order.items} />
            </CardBody>
          </Card>

          {order.customer_notes && (
            <Card>
              <CardBody>
                <h2 className="font-semibold">Customer note</h2>
                <p className="mt-1 text-sm text-ink-muted">{order.customer_notes}</p>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader>
              <h2 className="font-semibold">Status history</h2>
            </CardHeader>
            <CardBody className="pt-3">
              <OrderTimeline entries={order.status_history} />
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
                    to={`/seller/disputes/${dispute.id}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-line p-3 text-sm hover:border-brand-200"
                  >
                    <span>
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
          <Card>
            <CardHeader>
              <h2 className="inline-flex items-center gap-2 font-semibold">
                <UserRound className="size-4 text-brand-600" aria-hidden /> Customer
              </h2>
            </CardHeader>
            <CardBody className="space-y-1 pt-3 text-sm">
              <p className="font-medium">{order.customer?.name}</p>
              {order.customer?.email && (
                <a href={`mailto:${order.customer.email}`} className="flex items-center gap-1.5 text-ink-muted hover:text-ink">
                  <Mail className="size-3.5" aria-hidden /> {order.customer.email}
                </a>
              )}
              {order.customer?.phone && (
                <a href={`tel:${order.customer.phone}`} className="flex items-center gap-1.5 text-ink-muted hover:text-ink">
                  <Phone className="size-3.5" aria-hidden /> {order.customer.phone}
                </a>
              )}
            </CardBody>
          </Card>
          <AddressCard address={order.address} />
          <PaymentCard payment={order.payment} />
          <TotalsCard subtotal={order.subtotal} shipping={order.shipping_cost} discount={order.discount} total={order.total_amount} />
        </aside>
      </div>

      <ConfirmDialog
        open={pending !== null}
        title={pending?.label ?? 'Update order'}
        message={pending?.message ?? ''}
        confirmLabel={pending?.label ?? 'Confirm'}
        tone={pending?.status === 'returned' ? 'danger' : 'primary'}
        loading={busy}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          if (!pending) return
          void act(() => orderService.updateStatus(order.id, pending.status), 'Order status updated.')
        }}
      />

      {cancelOpen && (
        <CancelOrderModal
          open
          orderReference={order.reference_number}
          isSeller
          loading={busy}
          onClose={() => setCancelOpen(false)}
          onConfirm={(reason) => act(() => orderService.sellerCancel(order.id, reason), 'Order cancelled and stock restored.')}
        />
      )}

      <ConfirmDialog
        open={collectOpen}
        title="Record cash collected?"
        message={`Confirm that you received ${order.payment ? formatPrice(order.payment.amount) : 'the order total'} in cash. This does not change the order status.`}
        confirmLabel="Yes, cash received"
        tone="primary"
        loading={busy}
        onCancel={() => setCollectOpen(false)}
        onConfirm={() => void act(() => orderService.collectPayment(order.id), 'Cash collection recorded.')}
      />
    </div>
  )
}
