import { useState } from 'react'
import { Button, Modal, Select, Textarea } from '@/components/ui'
import { DISPUTE_REASONS, type DisputeReason } from '../types'

interface OpenDisputeModalProps {
  open: boolean
  orderReference: string
  loading?: boolean
  onClose: () => void
  onSubmit: (payload: { reason: DisputeReason; description: string }) => void | Promise<void>
}

/** A dispute starts with a category and a free-text description. */
export function OpenDisputeModal({ open, orderReference, loading = false, onClose, onSubmit }: OpenDisputeModalProps) {
  const [reason, setReason] = useState<DisputeReason>('item_damaged')
  const [description, setDescription] = useState('')
  const valid = description.trim().length >= 10

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Report a problem"
      description={`Open a dispute for order ${orderReference}. The seller and our support team can both reply.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button loading={loading} disabled={!valid} onClick={() => void onSubmit({ reason, description: description.trim() })}>
            Open dispute
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Select
          label="What went wrong?"
          value={reason}
          onChange={(e) => setReason(e.target.value as DisputeReason)}
          options={DISPUTE_REASONS.map((r) => ({ value: r.value, label: r.label }))}
        />
        <Textarea
          label="Tell us what happened"
          required
          rows={5}
          maxLength={2000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          hint="Include any details that help the seller resolve this quickly."
          placeholder="The box arrived crushed and the product is broken."
        />
        {description.length > 0 && description.trim().length < 10 && (
          <p role="alert" className="text-xs font-medium text-danger-600">
            Please add at least 10 characters.
          </p>
        )}
      </div>
    </Modal>
  )
}
