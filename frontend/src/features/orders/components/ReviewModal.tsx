import { Star } from 'lucide-react'
import { useState } from 'react'
import { Button, Modal, Textarea } from '@/components/ui'
import { cn } from '@/utils/cn'

interface ReviewModalProps {
  open: boolean
  productName: string
  loading?: boolean
  onClose: () => void
  onSubmit: (payload: { rating: number; comment?: string }) => void | Promise<void>
}

/** Star rating plus an optional written review. The API decides moderation. */
export function ReviewModal({ open, productName, loading = false, onClose, onSubmit }: ReviewModalProps) {
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [comment, setComment] = useState('')

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Review this purchase"
      description={productName}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            loading={loading}
            disabled={rating === 0 || (comment.length > 0 && comment.trim().length < 3)}
            onClick={() => void onSubmit({ rating, comment: comment.trim() || undefined })}
          >
            Submit review
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <fieldset>
          <legend className="text-sm font-medium text-ink">Your rating</legend>
          <div className="mt-2 flex gap-1" onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                aria-label={`${value} star${value === 1 ? '' : 's'}`}
                aria-pressed={rating === value}
                onMouseEnter={() => setHover(value)}
                onClick={() => setRating(value)}
                className="rounded-lg p-1 focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-100"
              >
                <Star
                  className={cn(
                    'size-8 transition-colors',
                    value <= (hover || rating) ? 'fill-accent-500 text-accent-500' : 'fill-line text-line',
                  )}
                />
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-ink-subtle">{rating > 0 ? `${rating} out of 5` : 'Choose a rating'}</p>
        </fieldset>

        <Textarea
          label="Your review (optional)"
          rows={4}
          maxLength={2000}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="How was the product quality and the packing?"
        />
        {comment.length > 0 && comment.trim().length < 3 && (
          <p role="alert" className="text-xs font-medium text-danger-600">
            Please write at least 3 characters, or leave the review empty.
          </p>
        )}
      </div>
    </Modal>
  )
}
