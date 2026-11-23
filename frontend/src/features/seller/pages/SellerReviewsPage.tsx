import { MessageSquareReply, Star } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { Button, Card, CardBody, EmptyState, Pagination, Skeleton, Tabs, Textarea } from '@/components/ui'
import { RatingStars } from '@/features/marketplace/components/RatingStars'
import { useAsync } from '@/hooks/useAsync'
import { ApiError } from '@/services/api/types'
import { toast } from '@/store/toastStore'
import { formatDate } from '@/utils/format'
import { sellerService } from '../sellerService'
import type { SellerReview } from '../types'

export default function SellerReviewsPage() {
  const [filter, setFilter] = useState<'all' | 'no' | 'yes'>('all')
  const [page, setPage] = useState(1)
  const { data, loading, reload } = useAsync(() => sellerService.reviews({ replied: filter === 'all' ? undefined : filter, page }), [filter, page])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Reviews</h1>
          <p className="mt-1 text-sm text-ink-muted">Reply publicly to customer reviews of your products.</p>
        </div>
        <Tabs label="Filter reviews" value={filter} onChange={(v) => { setFilter(v); setPage(1) }} items={[{ value: 'all', label: 'All' }, { value: 'no', label: 'Awaiting reply' }, { value: 'yes', label: 'Replied' }]} />
      </div>
      {loading && !data ? <Skeleton className="h-40" /> : data?.data.length === 0 ? (
        <EmptyState icon={Star} title="No reviews yet" message="Customers can review products after a completed purchase." />
      ) : (
        <ul className="space-y-4">{data?.data.map((r) => <li key={r.id}><ReviewCard review={r} onSaved={reload} /></li>)}</ul>
      )}
      {data && <Pagination page={data.meta.current_page} lastPage={data.meta.last_page} onChange={setPage} />}
    </div>
  )
}

function ReviewCard({ review, onSaved }: { review: SellerReview; onSaved: () => void }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState(review.seller_reply ?? '')
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      await sellerService.replyToReview(review.id, text)
      toast.success('Reply published.')
      setOpen(false)
      onSaved()
    } catch (e) {
      toast.error(e instanceof ApiError ? (e.errors.reply?.[0] ?? e.message) : 'Could not save the reply.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardBody>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <RatingStars value={review.rating} />
            <Link to={`/products/${review.product.slug}`} className="text-sm font-medium hover:text-brand-700">{review.product.name}</Link>
          </div>
          <span className="text-xs text-ink-subtle">{review.author} · {formatDate(review.created_at)}</span>
        </div>
        {review.comment && <p className="mt-3 text-sm">{review.comment}</p>}
        {review.seller_reply && !open && <p className="mt-3 rounded-xl bg-canvas p-3 text-sm text-ink-muted"><span className="font-medium text-ink">Your reply: </span>{review.seller_reply}</p>}
        {open ? (
          <div className="mt-3 space-y-2">
            <Textarea aria-label="Reply" rows={3} value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
              <Button size="sm" loading={saving} disabled={text.trim().length < 2} onClick={() => void save()}>Publish reply</Button>
            </div>
          </div>
        ) : (
          <Button variant="ghost" size="sm" className="mt-2" leftIcon={<MessageSquareReply className="size-4" />} onClick={() => setOpen(true)}>{review.seller_reply ? 'Edit reply' : 'Reply'}</Button>
        )}
      </CardBody>
    </Card>
  )
}
