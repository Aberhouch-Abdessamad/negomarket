import {
  ArrowLeft,
  Check,
  CheckCheck,
  CircleSlash,
  Clock,
  Handshake,
  MessageSquareText,
  Send,
  ShieldCheck,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Alert, Avatar, Badge, Button, ConfirmDialog, EmptyState, Input, Skeleton, Textarea } from '@/components/ui'
import type { BadgeTone } from '@/components/ui/Badge'
import { useAuthStore } from '@/store/authStore'
import { useCartStore } from '@/store/cartStore'
import { toast } from '@/store/toastStore'
import { formatPrice } from '@/utils/format'
import NotFoundPage from '@/pages/NotFoundPage'
import { useAsync } from '@/hooks/useAsync'
import { cn } from '@/utils/cn'
import { negotiationService } from '../negotiationService'
import { useNegotiationBadgeStore } from '../negotiationBadgeStore'
import type { NegotiationDetail, NegotiationMessage, NegotiationOffer, NegotiationStatus } from '../types'
import { useNegotiationRealtime, type RealtimeMessagePayload } from '../useNegotiationRealtime'

const statusTone: Record<NegotiationStatus, BadgeTone> = {
  active: 'brand',
  accepted: 'success',
  converted_to_order: 'success',
  rejected: 'danger',
  expired: 'neutral',
  cancelled: 'neutral',
}

/** Merge server/realtime messages by id and client UUID, oldest first. */
export function mergeMessages(current: NegotiationMessage[], incoming: NegotiationMessage[]): NegotiationMessage[] {
  const byId = new Map(current.map((m) => [m.id, m]))
  const byClientId = new Map<string, number>()
  for (const m of current) if (m.client_message_id) byClientId.set(m.client_message_id, m.id)

  for (const message of incoming) {
    if (message.client_message_id) {
      const previousId = byClientId.get(message.client_message_id)
      // Replace an optimistic/echoed copy of the same message when the server
      // assigns its canonical id, instead of showing the message twice.
      if (previousId !== undefined && previousId !== message.id) byId.delete(previousId)
      byClientId.set(message.client_message_id, message.id)
    }
    byId.set(message.id, { ...byId.get(message.id), ...message })
  }

  return [...byId.values()].sort((a, b) => a.id - b.id)
}

function newClientId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export default function NegotiationThreadPage() {
  const { id = '' } = useParams()
  const negotiationId = Number(id)
  const { data, error, loading, reload } = useAsync(
    () => negotiationService.get(negotiationId),
    [negotiationId],
  )

  if (!Number.isInteger(negotiationId) || negotiationId <= 0) return <NotFoundPage />
  if (error?.status === 404 || error?.status === 403) return <NotFoundPage />
  if (error) return <div className="mx-auto max-w-4xl p-8"><Alert tone="danger">{error.message}</Alert></div>
  if (loading || !data) return <ThreadSkeleton />

  return <Thread key={data.id} negotiation={data} onChanged={reload} />
}

function Thread({ negotiation, onChanged }: { negotiation: NegotiationDetail; onChanged: () => void }) {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const addToCart = useCartStore((s) => s.add)
  const refreshBadge = useNegotiationBadgeStore((s) => s.refresh)
  const [messages, setMessages] = useState<NegotiationMessage[]>([])
  const [messagesLoading, setMessagesLoading] = useState(true)
  const [messagesError, setMessagesError] = useState<string | null>(null)
  const [checkingOut, setCheckingOut] = useState(false)
  const readTimer = useRef<number | undefined>(undefined)
  const endRef = useRef<HTMLDivElement>(null)

  const markRead = useCallback(async () => {
    try {
      await negotiationService.markRead(negotiation.id)
      window.dispatchEvent(new Event('negotiations:read'))
      void refreshBadge()
    } catch {
      // Read receipts are best-effort; the thread stays usable.
    }
  }, [negotiation.id, refreshBadge])

  const loadMessages = useCallback(async () => {
    try {
      const list = await negotiationService.messages(negotiation.id)
      setMessages((current) => mergeMessages(current, list))
      setMessagesError(null)
      await markRead()
    } catch (e) {
      setMessagesError((e as { message?: string }).message ?? 'Could not load messages.')
    } finally {
      setMessagesLoading(false)
    }
  }, [negotiation.id, markRead])

  useEffect(() => {
    void loadMessages()
  }, [loadMessages])

  useEffect(() => () => window.clearTimeout(readTimer.current), [])

  const scheduleRead = () => {
    window.clearTimeout(readTimer.current)
    readTimer.current = window.setTimeout(() => void markRead(), 400)
  }

  const { connected } = useNegotiationRealtime(negotiation.id, {
    onMessage: (message: RealtimeMessagePayload) => {
      const normalized: NegotiationMessage = {
        ...message,
        sender: message.sender ? { ...message.sender, name: message.sender.name ?? 'User' } : undefined,
      }
      setMessages((current) => mergeMessages(current, [normalized]))
      if (message.sender_id !== user?.id) scheduleRead()
    },
    onOffer: () => {
      onChanged()
      toast.info('The negotiation was updated.')
    },
    onExpired: () => {
      onChanged()
      toast.info('This negotiation expired.')
    },
    onReconnected: () => {
      void loadMessages()
      onChanged()
    },
  })

  useEffect(() => {
    // Optional call: jsdom and older browsers may not implement scrollIntoView.
    endRef.current?.scrollIntoView?.({ block: 'nearest' })
  }, [messages.length])

  const pending = negotiation.pending_offer
  const canRespond = Boolean(pending && pending.sender_role !== negotiation.role && pending.status === 'pending' && !pending.is_expired)
  const active = negotiation.status === 'active'
  const closed = !active && negotiation.status !== 'accepted'
  const counterpart = negotiation.role === 'seller' ? negotiation.customer : negotiation.store
  const backTo = negotiation.role === 'seller' && window.location.pathname.startsWith('/seller') ? '/seller/negotiations' : '/negotiations'

  const checkoutAtAgreedPrice = async () => {
    if (checkingOut) return
    setCheckingOut(true)
    const added = await addToCart({ negotiation_id: negotiation.id })
    setCheckingOut(false)
    if (added) navigate('/checkout')
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <Link to={backTo} className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> All negotiations
      </Link>

      <header className="mt-4 rounded-2xl border border-line bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-start gap-4">
          <Link to={`/products/${negotiation.product.slug}`} className="size-16 shrink-0 overflow-hidden rounded-xl bg-canvas">
            {negotiation.product.thumbnail_url || negotiation.product.image_url ? (
              <img src={negotiation.product.thumbnail_url ?? negotiation.product.image_url ?? ''} alt="" className="size-full object-cover" />
            ) : (
              <span className="grid size-full place-items-center text-ink-subtle"><Handshake className="size-6" /></span>
            )}
          </Link>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Link to={`/products/${negotiation.product.slug}`} className="truncate font-semibold hover:text-brand-700">
                {negotiation.product.name}
              </Link>
              <Badge tone={statusTone[negotiation.status]}>{negotiation.status_label}</Badge>
              {pending?.is_expired && <Badge tone="warning">Offer expired</Badge>}
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-ink-subtle">
              <span>{negotiation.role === 'seller' ? 'Buyer' : 'Seller'}: {counterpart.name}</span>
              <span>·</span>
              <span>Qty {negotiation.quantity}</span>
              <span>·</span>
              <span>Listed {formatPrice(negotiation.variant?.price ?? negotiation.product.price)}</span>
              {negotiation.variant && (
                <>
                  <span>·</span>
                  <span>{Object.values(negotiation.variant.attributes).join(' / ')}</span>
                </>
              )}
            </p>
            {negotiation.status === 'active' && negotiation.expires_at && (
              <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-warning-600">
                <Clock className="size-3" aria-hidden /> Current offer expires {formatDateTime(negotiation.expires_at)}
              </p>
            )}
            {negotiation.status === 'accepted' && negotiation.expires_at && (
              <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-success-600">
                <ShieldCheck className="size-3" aria-hidden /> Agreed price locked. Checkout by {formatDateTime(negotiation.expires_at)}.
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {active && (
              <CancelButton negotiationId={negotiation.id} onCancelled={onChanged} />
            )}
          </div>
        </div>

        {negotiation.status === 'accepted' && negotiation.accepted_offer && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-success-50 p-3 text-sm text-emerald-900 ring-1 ring-inset ring-emerald-200">
            <span>
              Agreed price: <strong>{formatPrice(negotiation.accepted_offer.amount)}</strong> per item
              {negotiation.quantity > 1 && <span> · {formatPrice(negotiation.accepted_offer.amount * negotiation.quantity)} total</span>}
            </span>
            {negotiation.role === 'customer' ? (
              <Button size="sm" loading={checkingOut} onClick={() => void checkoutAtAgreedPrice()}>
                Checkout at agreed price
              </Button>
            ) : (
              <span className="text-xs font-medium">The buyer can check out at this price until it expires.</span>
            )}
          </div>
        )}
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <section aria-labelledby="offer-history" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 id="offer-history" className="font-semibold">Offer history</h2>
            <span className="text-xs text-ink-subtle">{negotiation.offers.length} offer{negotiation.offers.length === 1 ? '' : 's'}</span>
          </div>

          {negotiation.offers.length === 0 ? (
            <EmptyState icon={Handshake} title="No offers yet" message="Offers will appear here with their full history." />
          ) : (
            <ol className="space-y-3">
              {negotiation.offers.map((offer, index) => (
                <OfferCard
                  key={offer.id}
                  offer={offer}
                  role={negotiation.role}
                  canRespond={canRespond && pending?.id === offer.id}
                  onDone={onChanged}
                  negotiationId={negotiation.id}
                  isLast={index === negotiation.offers.length - 1}
                />
              ))}
            </ol>
          )}

          {active && canRespond && (
            <CounterOfferForm negotiationId={negotiation.id} maxAmount={negotiation.variant?.price ?? negotiation.product.price} onDone={onChanged} />
          )}

          {active && !pending && (
            <Alert tone="info">There is no pending offer to respond to right now.</Alert>
          )}

          {active && pending && !canRespond && (
            <Alert tone="info">Waiting for {pending.sender_role === 'customer' ? 'the buyer' : 'the seller'} to respond to the latest offer.</Alert>
          )}

          {closed && (
            <Alert tone="info">{negotiation.status_label} — the offer history is kept for reference.</Alert>
          )}
        </section>

        <aside aria-labelledby="chat-heading" className="flex max-h-[38rem] min-h-[28rem] flex-col overflow-hidden rounded-2xl border border-line bg-surface lg:sticky lg:top-24">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div>
              <h2 id="chat-heading" className="flex items-center gap-2 font-semibold"><MessageSquareText className="size-4 text-brand-600" aria-hidden /> Chat</h2>
              <p className="text-xs text-ink-subtle">Messages are saved to the server.</p>
            </div>
            <span className={cn('inline-flex items-center gap-1 text-[11px] font-medium', connected ? 'text-success-600' : 'text-ink-subtle')}>
              <span className={cn('size-1.5 rounded-full', connected ? 'bg-success-600' : 'bg-line')} />
              {connected ? 'Live' : 'Offline'}
            </span>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messagesLoading && <div className="space-y-2"><Skeleton className="h-12" /><Skeleton className="h-12 w-2/3" /></div>}
            {messagesError && <Alert tone="danger">{messagesError}</Alert>}
            {!messagesLoading && messages.length === 0 && <p className="py-8 text-center text-sm text-ink-subtle">Start the conversation. Be clear about the price and quantity.</p>}
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} own={message.sender_id === user?.id} />
            ))}
            <div ref={endRef} />
          </div>

          <MessageComposer
            negotiationId={negotiation.id}
            disabled={closed}
            closed={closed}
            onSent={(message) => setMessages((current) => mergeMessages(current, [message]))}
          />
        </aside>
      </div>
    </div>
  )
}

function OfferCard({
  offer,
  role,
  canRespond,
  negotiationId,
  onDone,
  isLast,
}: {
  offer: NegotiationOffer
  role: 'customer' | 'seller'
  canRespond: boolean
  negotiationId: number
  onDone: () => void
  isLast: boolean
}) {
  const [acceptOpen, setAcceptOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const own = offer.sender_role === role

  const act = async (kind: 'accept' | 'reject') => {
    setBusy(true)
    try {
      if (kind === 'accept') {
        await negotiationService.accept(negotiationId, offer.id)
        toast.success('Offer accepted. Checkout is now available at the agreed price.')
        setAcceptOpen(false)
      } else {
        await negotiationService.reject(negotiationId, offer.id)
        toast.info('Offer rejected.')
        setRejectOpen(false)
      }
      onDone()
    } catch (e) {
      toast.error((e as { message?: string }).message ?? 'Could not update the offer.')
    } finally {
      setBusy(false)
    }
  }

  const tone: BadgeTone = offer.status === 'accepted' ? 'success' : offer.status === 'pending' ? 'warning' : offer.status === 'rejected' ? 'danger' : 'neutral'

  return (
    <li className={cn('rounded-2xl border bg-surface p-4', isLast && offer.status === 'pending' ? 'border-brand-200 ring-1 ring-brand-100' : 'border-line')}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Avatar name={offer.sender?.name ?? (offer.sender_role === 'seller' ? 'Seller' : 'Customer')} src={offer.sender?.avatar_url} size="sm" />
          <div>
            <p className="text-sm font-medium">
              {offer.sender_role === 'seller' ? 'Seller' : 'Customer'} offer {own && <span className="font-normal text-ink-subtle">(you)</span>}
            </p>
            <p className="text-xs text-ink-subtle">{formatDateTime(offer.created_at)}</p>
          </div>
        </div>
        <Badge tone={tone}>{offer.status_label}</Badge>
      </div>

      <p className="mt-3 text-2xl font-semibold">{formatPrice(offer.amount)}</p>
      {offer.message && <p className="mt-1 whitespace-pre-line text-sm text-ink-muted">{offer.message}</p>}
      <p className="mt-2 flex flex-wrap gap-x-3 text-xs text-ink-subtle">
        {offer.status === 'pending' && <span>Expires {formatDateTime(offer.expires_at)}</span>}
        {offer.responded_at && <span>Answered {formatDateTime(offer.responded_at)}</span>}
        {offer.parent_offer_id && <span>Counter to offer #{offer.parent_offer_id}</span>}
      </p>

      {canRespond && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" leftIcon={<Check className="size-4" />} onClick={() => setAcceptOpen(true)}>Accept</Button>
          <Button size="sm" variant="secondary" leftIcon={<X className="size-4" />} onClick={() => setRejectOpen(true)}>Reject</Button>
        </div>
      )}

      <ConfirmDialog
        open={acceptOpen}
        title="Accept this offer?"
        message={`You agree to ${formatPrice(offer.amount)} per item. This locks the price for this negotiation and enables checkout.`}
        confirmLabel="Accept offer"
        tone="primary"
        loading={busy}
        onConfirm={() => void act('accept')}
        onCancel={() => setAcceptOpen(false)}
      />
      <ConfirmDialog
        open={rejectOpen}
        title="Reject this offer?"
        message="Rejecting closes the negotiation. The history stays visible, but you cannot send more messages or offers."
        confirmLabel="Reject offer"
        loading={busy}
        onConfirm={() => void act('reject')}
        onCancel={() => setRejectOpen(false)}
      />
    </li>
  )
}

function CounterOfferForm({ negotiationId, maxAmount, onDone }: { negotiationId: number; maxAmount: number; onDone: () => void }) {
  const [amount, setAmount] = useState(String(maxAmount))
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setFieldError(null)
    const numeric = Number(amount)
    if (!Number.isFinite(numeric) || numeric <= 0) {
      setFieldError('Enter an amount greater than zero.')
      return
    }
    if (numeric > maxAmount) {
      setFieldError(`A counter-offer cannot exceed the listed price of ${formatPrice(maxAmount)}.`)
      return
    }

    setSaving(true)
    try {
      await negotiationService.counter(negotiationId, { amount: numeric, message: message.trim() || null })
      toast.success('Counter-offer sent.')
      setMessage('')
      onDone()
    } catch (e) {
      const apiError = e as { message?: string; errors?: Record<string, string[]> }
      setError(apiError.message ?? 'Could not send the counter-offer.')
      setFieldError(apiError.errors?.amount?.[0] ?? null)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-line bg-surface p-4">
      <h3 className="font-semibold">Send a counter-offer</h3>
      <p className="mt-0.5 text-xs text-ink-muted">The other participant can accept, reject, or counter again.</p>
      {error && <div className="mt-3"><Alert tone="danger">{error}</Alert></div>}
      <div className="mt-3 grid gap-3 sm:grid-cols-[10rem_1fr]">
        <Input
          label="Amount (MAD)"
          type="number"
          min="0.01"
          max={maxAmount}
          step="0.01"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          error={fieldError ?? undefined}
        />
        <Textarea
          label="Message (optional)"
          value={message}
          maxLength={2000}
          onChange={(e) => setMessage(e.target.value)}
          className="min-h-11"
          rows={2}
          placeholder="Explain your counter-offer…"
        />
      </div>
      <div className="mt-3 flex justify-end">
        <Button type="submit" loading={saving} leftIcon={<Send className="size-4" />}>Send counter-offer</Button>
      </div>
    </form>
  )
}

function CancelButton({ negotiationId, onCancelled }: { negotiationId: number; onCancelled: () => void }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const cancel = async () => {
    setBusy(true)
    try {
      await negotiationService.cancel(negotiationId, 'Cancelled by participant')
      toast.info('Negotiation cancelled.')
      setOpen(false)
      onCancelled()
    } catch (e) {
      toast.error((e as { message?: string }).message ?? 'Could not cancel the negotiation.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button size="sm" variant="ghost" leftIcon={<CircleSlash className="size-4" />} onClick={() => setOpen(true)}>Cancel</Button>
      <ConfirmDialog
        open={open}
        title="Cancel this negotiation?"
        message="Pending offers are withdrawn, the conversation closes, and the history remains for both participants."
        confirmLabel="Cancel negotiation"
        loading={busy}
        onConfirm={() => void cancel()}
        onCancel={() => setOpen(false)}
      />
    </>
  )
}

function MessageBubble({ message, own }: { message: NegotiationMessage; own: boolean }) {
  return (
    <div className={cn('flex gap-2', own ? 'flex-row-reverse' : 'flex-row')}>
      <Avatar name={message.sender?.name ?? 'User'} src={message.sender?.avatar_url} size="sm" className="mt-auto" />
      <div className={cn('max-w-[85%]', own ? 'items-end text-right' : 'items-start')}>
        <div
          className={cn(
            'whitespace-pre-line break-words rounded-2xl px-3 py-2 text-sm',
            own ? 'rounded-br-md bg-brand-600 text-white' : 'rounded-bl-md bg-canvas text-ink',
          )}
        >
          {message.body}
        </div>
        <p className={cn('mt-1 flex items-center gap-1 text-[11px] text-ink-subtle', own && 'justify-end')}>
          {message.type === 'offer' && <><Handshake className="size-3" aria-hidden /> Offer · </>}
          {formatTime(message.created_at)}
          {own && (message.read_at ? <><CheckCheck className="size-3 text-brand-600" aria-hidden /> Read</> : <><Check className="size-3" aria-hidden /> Sent</>)}
        </p>
      </div>
    </div>
  )
}

function MessageComposer({
  negotiationId,
  disabled,
  closed,
  onSent,
}: {
  negotiationId: number
  disabled: boolean
  closed: boolean
  onSent: (message: NegotiationMessage) => void
}) {
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const text = body.trim()
    if (!text) return
    setSending(true)
    setError(null)
    try {
      const message = await negotiationService.sendMessage(negotiationId, { message: text, client_message_id: newClientId() })
      setBody('')
      onSent(message)
    } catch (e) {
      setError((e as { message?: string }).message ?? 'Could not send the message.')
    } finally {
      setSending(false)
    }
  }

  if (closed) {
    return <div className="border-t border-line bg-canvas px-4 py-3 text-center text-xs text-ink-subtle">This conversation is closed.</div>
  }

  return (
    <form onSubmit={submit} className="border-t border-line p-3">
      {error && <p role="alert" className="mb-2 text-xs font-medium text-danger-600">{error}</p>}
      <div className="flex items-end gap-2">
        <Textarea
          aria-label="Message"
          placeholder="Write a message…"
          value={body}
          maxLength={2000}
          rows={2}
          className="min-h-10 flex-1 resize-none py-2"
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              e.currentTarget.form?.requestSubmit()
            }
          }}
          disabled={disabled || sending}
        />
        <Button type="submit" loading={sending} disabled={!body.trim()} aria-label="Send message" className="size-10 p-0">
          <Send className="size-4" />
        </Button>
      </div>
      <p className="mt-1 text-[11px] text-ink-subtle">Enter to send · Shift+Enter for a new line</p>
    </form>
  )
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function ThreadSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <Skeleton className="h-4 w-36" />
      <Skeleton className="mt-4 h-28 rounded-2xl" />
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-3"><Skeleton className="h-40 rounded-2xl" /><Skeleton className="h-40 rounded-2xl" /></div>
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    </div>
  )
}
