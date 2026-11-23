import { Badge, type BadgeTone } from '@/components/ui'
import type { DisputeStatus, OrderStatus } from '../types'

const orderTones: Record<OrderStatus, BadgeTone> = {
  pending: 'warning',
  confirmed: 'brand',
  processing: 'brand',
  shipped: 'brand',
  delivered: 'success',
  cancelled: 'danger',
  returned: 'neutral',
}

export function OrderStatusBadge({ status, label }: { status: string; label?: string }) {
  const tone = orderTones[status as OrderStatus] ?? 'neutral'
  return <Badge tone={tone}>{label ?? status.replace(/_/g, ' ')}</Badge>
}

const disputeTones: Record<DisputeStatus, BadgeTone> = {
  open: 'warning',
  under_review: 'brand',
  resolved: 'success',
  rejected: 'danger',
  closed: 'neutral',
}

export function DisputeStatusBadge({ status, label }: { status: string; label?: string }) {
  const tone = disputeTones[status as DisputeStatus] ?? 'neutral'
  return <Badge tone={tone}>{label ?? status.replace(/_/g, ' ')}</Badge>
}

export function PaymentStatusBadge({ status, label }: { status: string; label?: string }) {
  return <Badge tone={status === 'collected' ? 'success' : 'neutral'}>{label ?? status.replace(/_/g, ' ')}</Badge>
}
