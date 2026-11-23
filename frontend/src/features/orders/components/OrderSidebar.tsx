import { Banknote, MapPin, ReceiptText } from 'lucide-react'
import { Card, CardBody, CardHeader } from '@/components/ui'
import type { AddressSnapshot, PaymentInfo } from '../types'
import { formatPrice } from '@/utils/format'
import { PaymentStatusBadge } from './OrderStatusBadge'

export function AddressCard({ address }: { address: AddressSnapshot | null }) {
  if (!address) return null

  return (
    <Card>
      <CardHeader>
        <h2 className="inline-flex items-center gap-2 font-semibold">
          <MapPin className="size-4 text-brand-600" aria-hidden /> Delivery address
        </h2>
      </CardHeader>
      <CardBody className="pt-3 text-sm">
        <p className="font-medium">{address.full_name}</p>
        <p className="text-ink-muted">{address.phone}</p>
        <p className="mt-1 text-ink-muted">
          {address.address_line1}
          {address.address_line2 ? `, ${address.address_line2}` : ''}
        </p>
        <p className="text-ink-muted">
          {address.city}
          {address.region ? `, ${address.region}` : ''}
          {address.postal_code ? ` ${address.postal_code}` : ''}
        </p>
        {address.delivery_notes && <p className="mt-2 rounded-lg bg-canvas p-2 text-xs text-ink-muted">Note: {address.delivery_notes}</p>}
      </CardBody>
    </Card>
  )
}

export function PaymentCard({ payment }: { payment: PaymentInfo | null }) {
  if (!payment) return null

  return (
    <Card>
      <CardHeader>
        <h2 className="inline-flex items-center gap-2 font-semibold">
          <Banknote className="size-4 text-brand-600" aria-hidden /> Payment
        </h2>
        <PaymentStatusBadge status={payment.status} label={payment.status_label} />
      </CardHeader>
      <CardBody className="space-y-1 pt-3 text-sm">
        <p className="flex items-center justify-between gap-3">
          <span className="text-ink-muted">{payment.method_label}</span>
          <span className="font-semibold">{formatPrice(payment.amount)}</span>
        </p>
        {payment.collected_at && (
          <p className="text-xs text-ink-subtle">
            Collected {new Date(payment.collected_at).toLocaleDateString('en-GB')}
            {payment.collector_name ? ` by ${payment.collector_name}` : ''}
          </p>
        )}
        {!payment.collected_at && <p className="text-xs text-ink-subtle">Pay the courier in cash when the parcel arrives.</p>}
      </CardBody>
    </Card>
  )
}

export function TotalsCard({ subtotal, shipping, discount, total, label = 'Order total' }: { subtotal: number; shipping: number; discount: number; total: number; label?: string }) {
  return (
    <Card>
      <CardHeader>
        <h2 className="inline-flex items-center gap-2 font-semibold">
          <ReceiptText className="size-4 text-brand-600" aria-hidden /> {label}
        </h2>
      </CardHeader>
      <CardBody className="space-y-1.5 pt-3 text-sm">
        <Row label="Subtotal" value={formatPrice(subtotal)} />
        <Row label="Shipping" value={shipping > 0 ? formatPrice(shipping) : 'Free'} />
        {discount > 0 && <Row label="Discount" value={`- ${formatPrice(discount)}`} />}
        <div className="mt-2 flex items-center justify-between border-t border-line pt-2 font-semibold">
          <span>Total</span>
          <span>{formatPrice(total)}</span>
        </div>
      </CardBody>
    </Card>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex items-center justify-between gap-3">
      <span className="text-ink-muted">{label}</span>
      <span>{value}</span>
    </p>
  )
}
