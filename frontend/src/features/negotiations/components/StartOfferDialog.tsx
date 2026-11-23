import { Handshake, Send } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { Alert, Button, Input, Modal, Textarea } from '@/components/ui'
import type { ProductDetail, ProductVariantOption } from '@/features/marketplace/types'
import { useAuthStore } from '@/store/authStore'
import { toast } from '@/store/toastStore'
import { formatPrice } from '@/utils/format'
import { negotiationService } from '../negotiationService'

interface Props {
  product: ProductDetail
  variant?: ProductVariantOption
  open: boolean
  onClose: () => void
}

/**
 * First structured offer for a product. The amount defaults to the listed
 * price and is only a suggestion — the API validates it against the seller's
 * private minimum (never sent to the browser).
 */
export function StartOfferDialog({ product, variant, open, onClose }: Props) {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const maxQuantity = variant?.stock_quantity ?? product.stock_quantity
  const suggested = variant?.price ?? product.price

  const [amount, setAmount] = useState(String(suggested))
  const [quantity, setQuantity] = useState('1')
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})
  const [saving, setSaving] = useState(false)

  const reset = () => {
    setAmount(String(suggested))
    setQuantity('1')
    setMessage('')
    setError(null)
    setFieldErrors({})
    setSaving(false)
  }

  const close = () => {
    if (saving) return
    reset()
    onClose()
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setFieldErrors({})

    const numericAmount = Number(amount)
    const numericQuantity = Number(quantity)
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setFieldErrors({ amount: ['Enter an offer amount greater than zero.'] })
      return
    }
    if (numericAmount > suggested) {
      setFieldErrors({ amount: [`Your offer cannot exceed the listed price of ${formatPrice(suggested)}.`] })
      return
    }
    if (!Number.isInteger(numericQuantity) || numericQuantity < 1 || numericQuantity > maxQuantity) {
      setFieldErrors({ quantity: [`Choose a quantity between 1 and ${maxQuantity}.`] })
      return
    }

    setSaving(true)
    try {
      const negotiation = await negotiationService.start({
        product_id: product.id,
        product_variant_id: variant?.id ?? null,
        quantity: numericQuantity,
        amount: numericAmount,
        message: message.trim() || null,
      })
      toast.success('Offer sent. You can chat with the seller while it is pending.')
      reset()
      onClose()
      navigate(`/negotiations/${negotiation.id}`)
    } catch (e) {
      const apiError = e as { message?: string; errors?: Record<string, string[]> }
      setError(apiError.message ?? 'Could not send your offer.')
      setFieldErrors(apiError.errors ?? {})
    } finally {
      setSaving(false)
    }
  }

  const ownStore = user?.store?.id === product.store.id

  return (
    <Modal
      open={open}
      onClose={close}
      title="Make an offer"
      description={`${product.name}${variant ? ` · ${Object.values(variant.attributes).join(' / ')}` : ''}`}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="start-offer-form" loading={saving} leftIcon={<Send className="size-4" />} disabled={ownStore}>
            Send offer
          </Button>
        </>
      }
    >
      {ownStore ? (
        <Alert tone="warning">You cannot negotiate with your own store. Open the product from another account to test offers.</Alert>
      ) : (
        <form id="start-offer-form" onSubmit={submit} className="space-y-4">
          {error && <Alert tone="danger">{error}</Alert>}

          <div className="rounded-xl bg-canvas p-3 text-sm text-ink-muted">
            <p className="flex items-center gap-2 font-medium text-ink">
              <Handshake className="size-4 text-brand-600" aria-hidden /> Listed price {formatPrice(suggested)}
            </p>
            <p className="mt-1 text-xs">
              The seller may accept, reject, or send a counter-offer. Your offer stays private to this store.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Your offer (MAD)"
              type="number"
              min="0.01"
              max={suggested}
              step="0.01"
              inputMode="decimal"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              error={fieldErrors.amount?.[0]}
            />
            <Input
              label="Quantity"
              type="number"
              min={1}
              max={maxQuantity}
              step={1}
              required
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              error={fieldErrors.quantity?.[0]}
              hint={`${maxQuantity} available`}
            />
          </div>

          <Textarea
            label="Message to the seller (optional)"
            value={message}
            maxLength={2000}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Tell the seller why this price works for you…"
            error={fieldErrors.message?.[0]}
          />

          <p className="text-xs text-ink-subtle">
            Offers expire automatically. The seller's minimum price is private and is never shown to customers.
          </p>
        </form>
      )}
    </Modal>
  )
}
