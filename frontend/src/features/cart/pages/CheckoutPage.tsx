import { ArrowLeft, Check, CreditCard, MapPin, Package, ShieldCheck, ShoppingBag, Store, Truck } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Alert, Badge, Button, Card, CardBody, EmptyState, Skeleton, Textarea } from '@/components/ui'
import { accountService, type Address } from '@/features/account/accountService'
import { cartService, newIdempotencyKey } from '@/features/cart/cartService'
import type { CheckoutPreview, OrderGroup } from '@/features/cart/types'
import { useAsync } from '@/hooks/useAsync'
import { ApiError } from '@/services/api/types'
import { useCartStore } from '@/store/cartStore'
import { toast } from '@/store/toastStore'
import { formatPrice } from '@/utils/format'
import { cn } from '@/utils/cn'

/**
 * Checkout: pick a delivery address, review server-priced totals, then place
 * the order. A single Idempotency-Key is reused across retries so a lost
 * response cannot create a duplicate order group.
 */
export default function CheckoutPage() {
  const [addressId, setAddressId] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [placing, setPlacing] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const idempotencyKey = useRef(newIdempotencyKey())
  const navigate = useNavigate()
  const resetCart = useCartStore((s) => s.reset)

  const { data, error, loading, reload } = useAsync(async () => {
    const [addresses, cart] = await Promise.all([accountService.addresses(), cartService.summary()])
    let preview: CheckoutPreview | null = null
    if (cart.item_count > 0) {
      preview = await cartService.preview(addressId ? { address_id: addressId } : {})
    }
    return { addresses, cart, preview }
  }, [addressId])

  useEffect(() => {
    if (!data || addressId !== null) return
    const preferred = data.addresses.find((a) => a.is_default) ?? data.addresses[0]
    if (preferred) setAddressId(preferred.id)
  }, [data, addressId])

  if (loading && !data) return <CheckoutSkeleton />

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <Alert tone="danger" title="Checkout is unavailable">{error.message}</Alert>
        <div className="mt-4 flex gap-2">
          <Link to="/cart"><Button variant="secondary" leftIcon={<ArrowLeft className="size-4" />}>Back to cart</Button></Link>
          <Button onClick={reload}>Try again</Button>
        </div>
      </div>
    )
  }

  if (!data || !data.preview || data.cart.item_count === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <EmptyState
          icon={ShoppingBag}
          title="Nothing to check out"
          message="Add a product to your cart first, or accept a seller's offer to buy at the agreed price."
          action={<Link to="/products"><Button>Browse products</Button></Link>}
        />
      </div>
    )
  }

  const { addresses, preview } = data
  const selectedAddress = addresses.find((a) => a.id === addressId)

  async function placeOrder() {
    if (!addressId) {
      setFormError('Choose a delivery address before placing the order.')
      return
    }
    setPlacing(true)
    setFormError(null)
    try {
      const group: OrderGroup = await cartService.place(
        { address_id: addressId, customer_notes: notes.trim() || undefined },
        idempotencyKey.current,
      )
      idempotencyKey.current = newIdempotencyKey()
      resetCart()
      toast.success('Order placed. Pay cash when it arrives.')
      navigate('/checkout/success', { state: { group }, replace: true })
    } catch (e) {
      setFormError(e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : 'Could not place the order. Please try again.')
    } finally {
      setPlacing(false)
    }
  }

  return (
    <div className="mx-auto max-w-[90rem] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <Link to="/cart" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Back to cart
      </Link>
      <h1 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">Checkout</h1>
      <p className="mt-1 text-sm text-ink-muted">Delivery details, then a final review. Payment is cash on delivery.</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="space-y-5">
          <Card>
            <CardBody className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="inline-flex items-center gap-2 font-semibold"><MapPin className="size-4 text-brand-600" aria-hidden /> Delivery address</h2>
                <Link to="/account/addresses" className="text-sm font-medium text-brand-600 hover:text-brand-700">
                  {addresses.length ? 'Manage addresses' : 'Add an address'}
                </Link>
              </div>

              {addresses.length === 0 ? (
                <Alert tone="warning" title="No delivery address yet">
                  <p>Add an address to your account, then come back to finish the order.</p>
                  <Link to="/account/addresses" className="mt-2 inline-block font-semibold underline">Add a delivery address</Link>
                </Alert>
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {addresses.map((address) => (
                    <li key={address.id}>
                      <AddressOption address={address} selected={address.id === addressId} onSelect={() => setAddressId(address.id)} />
                    </li>
                  ))}
                </ul>
              )}

              {selectedAddress && (
                <p className="text-xs text-ink-subtle">
                  The order will be delivered to {selectedAddress.full_name}, {selectedAddress.phone}.
                </p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-4">
              <h2 className="inline-flex items-center gap-2 font-semibold"><Package className="size-4 text-brand-600" aria-hidden /> Review your order</h2>
              <ul className="space-y-4">
                {preview.groups.map((group) => (
                  <li key={group.store.id} className="rounded-xl border border-line">
                    <div className="flex items-center gap-2 border-b border-line px-3.5 py-2.5">
                      <Store className="size-3.5 text-ink-subtle" aria-hidden />
                      <Link to={`/stores/${group.store.slug}`} className="text-sm font-medium hover:text-brand-700">{group.store.name}</Link>
                      <span className="ml-auto text-xs text-ink-subtle">Order {group.items.length === 1 ? '1 item' : `${group.items.length} items`}</span>
                    </div>
                    <ul className="divide-y divide-line">
                      {group.items.map((line) => (
                        <li key={line.key} className="flex items-center gap-3 px-3.5 py-3">
                          <span className="size-11 shrink-0 overflow-hidden rounded-lg bg-canvas">
                            {line.product.thumbnail_url
                              ? <img src={line.product.thumbnail_url} alt="" className="size-full object-cover" />
                              : <span className="grid size-full place-items-center text-ink-subtle"><ShoppingBag className="size-4" /></span>}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{line.product.name}</p>
                            <p className="text-xs text-ink-subtle">
                              {line.variant ? `${Object.values(line.variant.attributes).join(' / ')} · ` : ''}Qty {line.quantity}
                              {line.is_negotiated && <Badge tone="success" className="ml-2">Agreed price</Badge>}
                            </p>
                          </div>
                          <div className="text-right text-sm">
                            <p className="font-medium">{formatPrice(line.line_total)}</p>
                            <p className="text-xs text-ink-subtle">{formatPrice(line.unit_price)} each</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-3">
              <h2 className="inline-flex items-center gap-2 font-semibold"><Truck className="size-4 text-brand-600" aria-hidden /> Delivery notes</h2>
              <Textarea
                label="Notes for the courier or seller (optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={1000}
                placeholder="Landmark, preferred delivery time, floor…"
              />
            </CardBody>
          </Card>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card>
            <CardBody className="space-y-4">
              <h2 className="font-semibold">Payment &amp; totals</h2>
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between"><dt className="text-ink-muted">Subtotal</dt><dd>{formatPrice(preview.summary.subtotal)}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-muted">Shipping</dt><dd>{preview.summary.shipping_total > 0 ? formatPrice(preview.summary.shipping_total) : 'Free'}</dd></div>
                <div className="flex justify-between border-t border-line pt-2 text-base font-semibold"><dt>Total</dt><dd>{formatPrice(preview.summary.total)}</dd></div>
              </dl>

              <div className="rounded-xl bg-brand-50 p-3 text-xs text-brand-900 ring-1 ring-inset ring-brand-200">
                <p className="inline-flex items-center gap-1.5 font-semibold"><CreditCard className="size-3.5" aria-hidden /> Cash on Delivery</p>
                <p className="mt-1">No card needed. Pay the courier in cash when your order arrives.</p>
              </div>

              {formError && <Alert tone="danger">{formError}</Alert>}

              <Button size="lg" className="w-full" loading={placing} disabled={!addressId || addresses.length === 0} leftIcon={<ShieldCheck className="size-5" />} onClick={() => void placeOrder()}>
                Place order · {formatPrice(preview.summary.total)}
              </Button>
              <p className="text-center text-xs text-ink-subtle">
                One order is created per store. Your cart will be cleared and the agreed prices locked in.
              </p>
            </CardBody>
          </Card>
        </aside>
      </div>
    </div>
  )
}

function AddressOption({ address, selected, onSelect }: { address: Address; selected: boolean; onSelect: () => void }) {
  return (
    <label className={cn('flex cursor-pointer gap-3 rounded-xl border p-3.5 text-sm transition', selected ? 'border-brand-600 bg-brand-50/60 ring-2 ring-brand-100' : 'border-line hover:border-ink-subtle')}>
      <input type="radio" name="delivery-address" className="mt-1 size-4 accent-brand-600" checked={selected} onChange={onSelect} />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2 font-medium">
          {address.full_name}
          {address.is_default && <Badge tone="brand">Default</Badge>}
          {address.label && <span className="text-xs font-normal text-ink-subtle">{address.label}</span>}
        </span>
        <span className="mt-1 block text-ink-muted">
          {address.address_line1}{address.address_line2 ? `, ${address.address_line2}` : ''}
          <br />{address.city}{address.region ? `, ${address.region}` : ''}{address.postal_code ? ` ${address.postal_code}` : ''}
          <br />{address.country} · {address.phone}
        </span>
        {selected && <span className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-brand-700"><Check className="size-3" aria-hidden /> Delivering here</span>}
      </span>
    </label>
  )
}

function CheckoutSkeleton() {
  return (
    <div className="mx-auto grid max-w-[90rem] gap-6 px-4 py-10 lg:grid-cols-[minmax(0,1fr)_23rem] lg:px-8">
      <div className="space-y-5">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-52 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
      <Skeleton className="h-72 rounded-2xl" />
    </div>
  )
}
