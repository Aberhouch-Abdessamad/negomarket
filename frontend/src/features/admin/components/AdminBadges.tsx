import { Badge, type BadgeTone } from '@/components/ui'
import type { AdminReviewStatus, AdminStoreStatus, AdminUserStatus } from '../types'

const userTones: Record<AdminUserStatus, BadgeTone> = { active: 'success', suspended: 'danger' }
const storeTones: Record<AdminStoreStatus, BadgeTone> = {
  pending: 'warning',
  active: 'success',
  suspended: 'danger',
  closed: 'neutral',
}
const reviewTones: Record<AdminReviewStatus, BadgeTone> = { pending: 'warning', approved: 'success', rejected: 'danger' }

export function UserStatusBadge({ status, label }: { status: string; label?: string }) {
  return <Badge tone={userTones[status as AdminUserStatus] ?? 'neutral'}>{label ?? status}</Badge>
}

export function StoreStatusBadge({ status, label }: { status: string; label?: string }) {
  return <Badge tone={storeTones[status as AdminStoreStatus] ?? 'neutral'}>{label ?? status}</Badge>
}

export function ReviewStatusBadge({ status, label }: { status: string; label?: string }) {
  return <Badge tone={reviewTones[status as AdminReviewStatus] ?? 'neutral'}>{label ?? status}</Badge>
}
