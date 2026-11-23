import { Badge, type BadgeTone } from '@/components/ui'
import type { ProductStatus } from '../types'

const map: Record<ProductStatus, { tone: BadgeTone; label: string }> = {
  draft: { tone: 'neutral', label: 'Draft' },
  pending_review: { tone: 'warning', label: 'In review' },
  published: { tone: 'success', label: 'Published' },
  rejected: { tone: 'danger', label: 'Rejected' },
  archived: { tone: 'neutral', label: 'Archived' },
}

export function ProductStatusBadge({ status }: { status: ProductStatus }) {
  const { tone, label } = map[status]
  return <Badge tone={tone}>{label}</Badge>
}
