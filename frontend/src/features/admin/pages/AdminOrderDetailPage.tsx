import { AlertTriangle, ArrowLeft, CheckCircle2, MessageSquareText, Package, RotateCcw, Store as StoreIcon, Truck, UserRound } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { Alert, Button, Card, CardBody, CardHeader, ConfirmDialog, EmptyState, Skeleton } from '@/components/ui'
import { useAsync } from '@/hooks/useAsync'
import { ApiError } from '@/services/api/types'
import { toast } from '@/store/toastStore'
import { formatDate, formatPrice } from '@/utils/format'
import { CancelOrderModal } from '@/features/orders/components/CancelOrderModal'
import { OrderItems } from '@/features/orders/components/OrderItems'
import { AddressCard, PaymentCard, TotalsCard } from '@/features/orders/components/OrderSidebar'
import { DisputeStatusBadge, OrderStatusBadge } from '@/features/orders/components/OrderStatusBadge'
import { OrderTimeline } from '@/features/orders/components/OrderTimeline'
import type { OrderDetail, OrderStatus } from '@/features/orders/types'
import { adminService } from '../adminService'

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

/** Administrative view of a single order: inspect, override status, cancel. */
export default function AdminOrderDetailPage() {
  const { id } = useParams()
  const orderId = Number(id)
  const { data, error, loading, reload } = useAsync(() => adminService.order(orderId), [orderId])

  const [cancelOpen, setCancelOpen] = useState(false)
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
        message={error?.status === 403 ? 'You do not have permission to view this order.' : (error?.message ?? 'We could not load this order.')}
        action={<Link to="/admin/orders"><Button>Back to orders</Button></Link>}
      />
    )
  }

  const order = data
  const nextActions = NEXT_ACTIONS[order.status] ?? []
  const canCancel = !['cancelled', 'returned'].includes(order.status)

  async function act(work: () => Promise<OrderDetail>, success: string) {
    setBusy(true)
    try {
      await work()
      toast.success(success)
      setPending(null)
      setCancelOpen(false)
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
        <Link to="/admin/orders" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden /> All orders
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">{order.reference_number}</h1>
            <p className="mt-1 text-sm text-ink-muted">
              {order.customer?.name} · {order.store?.name} · {order.created_at ? formatDate(order.created_at) : 'recently'} · {formatPrice(order.total_amount)}
            </p>
          </div>
          <OrderStatusBadge status={order.status} label={order.status_label} />
        </div>
      </div>

      {order.status === 'cancelled' && (
        <Alert tone="danger" title="Order cancelled">{order.cancellation_reason ?? 'No reason was recorded.'}</Alert>
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
                      ? 'This restores the sold stock to the seller inventory. Only mark returned once the parcel is back.'
                      : `Change the status to ${status}. The customer and seller are notified.`,
                })
              }
            >
              {label}
            </Button>
          ))}
          {canCancel && (
            <Button size="sm" variant="ghost" onClick={() => setCancelOpen(true)}>Cancel order</Button>
          )}
          {!canCancel && nextActions.length === 0 && (
            <p className="text-sm text-ink-muted">No further action is needed for this order.</p>
          )}
        </CardBody>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <h2 className="font-semibold">Items</h2>
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
                    to={`/admin/disputes/${dispute.id}`}
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
              {order.customer?.email && <p className="text-ink-muted">{order.customer.email}</p>}
              {order.customer?.phone && <p className="text-ink-muted">{order.customer.phone}</p>}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="inline-flex items-center gap-2 font-semibold">
                <StoreIcon className="size-4 text-brand-600" aria-hidden /> Store
              </h2>
            </CardHeader>
            <CardBody className="pt-3 text-sm">
              {order.store ? (
                <Link to={`/stores/${order.store.slug}`} className="font-medium hover:text-brand-700">{order.store.name}</Link>
              ) : '—'}
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
          void act(() => adminService.updateOrderStatus(order.id, pending.status), 'Order status updated.')
        }}
      />

      {cancelOpen && (
        <CancelOrderModal
          open
          orderReference={order.reference_number}
          loading={busy}
          onClose={() => setCancelOpen(false)}
          onConfirm={(reason) => act(() => adminService.cancelOrder(order.id, reason), 'Order cancelled and stock restored.')}
        />
      )}
    </div>
  )
}
