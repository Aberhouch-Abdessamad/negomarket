import { useState } from 'react'
import { Button, Modal, Textarea } from '@/components/ui'

interface CancelOrderModalProps {
  open: boolean
  orderReference: string
  isSeller?: boolean
  loading?: boolean
  onClose: () => void
  onConfirm: (reason: string) => void | Promise<void>
}

/** Cancellation always records a reason on the order and its history. */
export function CancelOrderModal({ open, orderReference, isSeller = false, loading = false, onClose, onConfirm }: CancelOrderModalProps) {
  const [reason, setReason] = useState('')

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Cancel this order?"
      description={`Order ${orderReference}. This cannot be undone and reserved stock is released.`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Keep order
          </Button>
          <Button
            variant="danger"
            loading={loading}
            disabled={reason.trim().length > 0 && reason.trim().length < 3}
            onClick={() => void onConfirm(reason.trim())}
          >
            Cancel order
          </Button>
        </>
      }
    >
      <Textarea
        label={isSeller ? 'Reason for the customer' : 'Reason (optional)'}
        rows={3}
        maxLength={255}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={isSeller ? 'For example: the last unit was damaged in the warehouse.' : 'For example: I ordered the wrong size.'}
      />
      {reason.trim().length > 0 && reason.trim().length < 3 && (
        <p role="alert" className="mt-2 text-xs font-medium text-danger-600">
          Use at least 3 characters, or leave the reason empty.
        </p>
      )}
    </Modal>
  )
}
