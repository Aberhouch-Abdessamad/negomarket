import { Search, Star } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { Alert, Button, Card, CardBody, ConfirmDialog, EmptyState, Input, Pagination, Select, Skeleton, Tabs } from '@/components/ui'
import { useAsync } from '@/hooks/useAsync'
import { ApiError } from '@/services/api/types'
import { toast } from '@/store/toastStore'
import { formatDate } from '@/utils/format'
import { adminService } from '../adminService'
import { ReviewStatusBadge } from '../components/AdminBadges'
import type { AdminReview, AdminReviewStatus } from '../types'

type StatusTab = '' | AdminReviewStatus

const tabs: { value: StatusTab; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
]

const ratings = [
  { value: '', label: 'All ratings' },
  { value: '5', label: '5 stars' },
  { value: '4', label: '4 stars' },
  { value: '3', label: '3 stars' },
  { value: '2', label: '2 stars' },
  { value: '1', label: '1 star' },
]

export default function AdminReviewsPage() {
  const [tab, setTab] = useState<StatusTab>('pending')
  const [rating, setRating] = useState('')
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pendingReject, setPendingReject] = useState<AdminReview | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  const { data, error, loading, reload } = useAsync(
    () =>
      adminService.reviews({
        status: tab || undefined,
        rating: rating ? Number(rating) : undefined,
        q: query || undefined,
        page,
      }),
    [tab, rating, query, page],
  )

  async function moderate(review: AdminReview, status: 'approved' | 'rejected') {
    setBusyId(review.id)
    try {
      await adminService.moderateReview(review.id, status)
      toast.success(status === 'approved' ? 'Review approved and published.' : 'Review rejected and hidden.')
      setPendingReject(null)
      reload()
    } catch (e) {
      toast.error(e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : 'Could not moderate the review.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Reviews</h1>
        <p className="mt-1 text-sm text-ink-muted">Moderate product reviews before they appear on storefronts.</p>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <Tabs label="Filter reviews by status" value={tab} onChange={(value) => { setTab(value); setPage(1) }} items={tabs} />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select
            aria-label="Filter by rating"
            value={rating}
            onChange={(e) => { setRating(e.target.value); setPage(1) }}
            options={ratings}
            className="sm:w-40"
          />
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setQuery(search.trim()); setPage(1) }}>
            <Input
              aria-label="Search reviews"
              placeholder="Comment, author or product"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 sm:w-60"
              trailing={<Search className="size-4 text-ink-subtle" aria-hidden />}
            />
            <Button type="submit" variant="secondary">Search</Button>
          </form>
        </div>
      </div>

      {error && <Alert tone="danger">{error.message}</Alert>}

      {loading && !data ? (
        <Skeleton className="h-72 rounded-2xl" />
      ) : data?.data.length === 0 ? (
        <EmptyState
          icon={Star}
          title={tab === 'pending' ? 'The moderation queue is empty' : 'No reviews found'}
          message={tab === 'pending' ? 'New customer reviews will appear here for approval.' : 'Try a different status, rating or search term.'}
        />
      ) : (
        <div className="space-y-3">
          {data?.data.map((review) => (
            <Card key={review.id}>
              <CardBody className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Stars rating={review.rating} />
                      <ReviewStatusBadge status={review.status} label={review.status_label} />
                    </div>
                    <p className="mt-1.5 text-sm font-medium">
                      {review.product ? (
                        <Link to={`/products/${review.product.slug}`} className="hover:text-brand-700">{review.product.name}</Link>
                      ) : 'Deleted product'}
                      {review.product?.store && <span className="font-normal text-ink-subtle"> · {review.product.store.name}</span>}
                    </p>
                    <p className="text-xs text-ink-subtle">
                      {review.author?.name ?? 'Deleted account'}
                      {review.author?.email ? ` · ${review.author.email}` : ''}
                      {review.created_at ? ` · ${formatDate(review.created_at)}` : ''}
                      {review.order ? ` · order ${review.order.reference_number}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    {review.status !== 'approved' && (
                      <Button size="sm" loading={busyId === review.id} onClick={() => void moderate(review, 'approved')}>Approve</Button>
                    )}
                    {review.status !== 'rejected' && (
                      <Button size="sm" variant="danger" disabled={busyId === review.id} onClick={() => setPendingReject(review)}>Reject</Button>
                    )}
                  </div>
                </div>

                {review.comment ? (
                  <p className="rounded-xl bg-canvas p-3 text-sm text-ink-muted">{review.comment}</p>
                ) : (
                  <p className="text-sm text-ink-subtle">No written comment.</p>
                )}

                {review.seller_reply && (
                  <div className="rounded-xl border border-line p-3 text-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">Seller reply</p>
                    <p className="mt-1 text-ink-muted">{review.seller_reply}</p>
                  </div>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {data && <Pagination page={data.meta.current_page} lastPage={data.meta.last_page} onChange={setPage} />}

      <ConfirmDialog
        open={pendingReject !== null}
        title="Reject this review?"
        message="The review stays stored for the audit trail but is hidden from the product page."
        confirmLabel="Reject review"
        tone="danger"
        loading={busyId !== null}
        onCancel={() => setPendingReject(null)}
        onConfirm={() => { if (pendingReject) void moderate(pendingReject, 'rejected') }}
      />
    </div>
  )
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-warning-600" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} className={i < rating ? 'size-3.5 fill-current' : 'size-3.5 text-line'} aria-hidden />
      ))}
    </span>
  )
}
