import { MessageSquareText, Send, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { Badge, Button, Select, Textarea } from '@/components/ui'
import { ApiError } from '@/services/api/types'
import { toast } from '@/store/toastStore'
import { formatDate } from '@/utils/format'
import { cn } from '@/utils/cn'
import { orderService } from '../orderService'
import type { Dispute } from '../types'
import { DisputeStatusBadge } from './OrderStatusBadge'

interface DisputeThreadProps {
  dispute: Dispute
  currentUserId: number
  canReply: boolean
  canResolve: boolean
  onChanged: (dispute: Dispute) => void
}

const RESOLVE_OPTIONS = [
  { value: 'under_review', label: 'Mark under review' },
  { value: 'resolved', label: 'Resolve in the customer favour' },
  { value: 'rejected', label: 'Reject the claim' },
  { value: 'closed', label: 'Close without a decision' },
]

/** Conversation between buyer, seller and support, plus admin moderation. */
export function DisputeThread({ dispute, currentUserId, canReply, canResolve, onChanged }: DisputeThreadProps) {
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [status, setStatus] = useState('resolved')
  const [resolution, setResolution] = useState('')
  const [saving, setSaving] = useState(false)

  const closed = ['resolved', 'rejected', 'closed'].includes(dispute.status)
  const resolutionRequired = status === 'resolved' || status === 'rejected'

  async function send() {
    if (message.trim().length === 0) return
    setSending(true)
    try {
      onChanged(await orderService.message(dispute.id, message.trim()))
      setMessage('')
      toast.success('Message sent.')
    } catch (e) {
      toast.error(e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : 'Could not send the message.')
    } finally {
      setSending(false)
    }
  }

  async function resolve() {
    setSaving(true)
    try {
      const updated = await orderService.resolveDispute(dispute.id, {
        status,
        resolution: resolution.trim() || undefined,
      })
      onChanged(updated)
      setResolution('')
      toast.success('Dispute updated.')
    } catch (e) {
      toast.error(e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : 'Could not update the dispute.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="inline-flex items-center gap-2 font-semibold">
            <MessageSquareText className="size-4 text-brand-600" aria-hidden /> Dispute #{dispute.id}
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            {dispute.reason_label} · opened {dispute.created_at ? formatDate(dispute.created_at) : 'recently'}
            {dispute.opened_by ? ` by ${dispute.opened_by.name}` : ''}
          </p>
        </div>
        <DisputeStatusBadge status={dispute.status} label={dispute.status_label} />
      </div>

      <p className="rounded-xl bg-canvas p-3 text-sm text-ink-muted">{dispute.description}</p>

      {dispute.resolution && (
        <div className="rounded-xl border border-line bg-surface p-3 text-sm">
          <p className="inline-flex items-center gap-1.5 font-semibold">
            <ShieldCheck className="size-4 text-brand-600" aria-hidden /> Resolution
          </p>
          <p className="mt-1 text-ink-muted">{dispute.resolution}</p>
          {dispute.resolved_by && (
            <p className="mt-1 text-xs text-ink-subtle">
              {dispute.resolved_by.name}
              {dispute.resolved_at ? ` · ${formatDate(dispute.resolved_at)}` : ''}
            </p>
          )}
        </div>
      )}

      <ul className="space-y-3" aria-label="Dispute messages">
        {dispute.messages.map((entry) => {
          const mine = entry.sender?.id === currentUserId
          return (
            <li key={entry.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
              <div
                className={cn(
                  'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm',
                  mine ? 'bg-brand-600 text-white' : 'bg-canvas text-ink ring-1 ring-line',
                )}
              >
                <p className={cn('text-[11px] font-medium', mine ? 'text-brand-100' : 'text-ink-subtle')}>
                  {mine ? 'You' : (entry.sender?.name ?? 'Support')}
                  {entry.created_at ? ` · ${formatDate(entry.created_at)}` : ''}
                </p>
                <p className="mt-0.5 whitespace-pre-line">{entry.message}</p>
              </div>
            </li>
          )
        })}
      </ul>

      {canReply && !closed && (
        <form
          className="space-y-2 border-t border-line pt-4"
          onSubmit={(e) => {
            e.preventDefault()
            void send()
          }}
        >
          <Textarea
            aria-label="Message"
            rows={3}
            maxLength={2000}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Write a reply to the other party..."
          />
          <div className="flex justify-end">
            <Button type="submit" size="sm" loading={sending} disabled={message.trim().length === 0} leftIcon={<Send className="size-4" />}>
              Send message
            </Button>
          </div>
        </form>
      )}

      {canResolve && !closed && (
        <div className="space-y-3 rounded-xl border border-line bg-canvas/50 p-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-brand-600" aria-hidden />
            <h3 className="text-sm font-semibold">Support decision</h3>
            <Badge tone="brand">Admin</Badge>
          </div>
          <Select label="Update status" value={status} onChange={(e) => setStatus(e.target.value)} options={RESOLVE_OPTIONS} />
          <Textarea
            label={resolutionRequired ? 'Resolution (required)' : 'Internal note / resolution (optional)'}
            rows={3}
            maxLength={2000}
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
          />
          <div className="flex justify-end">
            <Button size="sm" loading={saving} disabled={resolutionRequired && resolution.trim().length < 3} onClick={() => void resolve()}>
              Save decision
            </Button>
          </div>
        </div>
      )}

      {closed && !canResolve && (
        <p className="text-xs text-ink-subtle">This dispute is closed. Contact support if you need to reopen it.</p>
      )}
    </div>
  )
}
