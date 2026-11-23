import { zodResolver } from '@hookform/resolvers/zod'
import { CheckCircle2, Clock, Handshake, PackagePlus, ShieldCheck, Store, Truck, XCircle } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { z } from 'zod'
import { Alert, Button, Card, CardBody, Checkbox, FullPageSpinner, Input, Textarea } from '@/components/ui'
import { useAsync } from '@/hooks/useAsync'
import { useAuthStore } from '@/store/authStore'
import { toast } from '@/store/toastStore'
import { applyServerErrors } from '@/utils/forms'
import { formatDate } from '@/utils/format'
import { sellerService } from '../sellerService'
import type { StoreApplication } from '../types'

const schema = z.object({
  business_name: z.string().trim().min(3, 'Use at least 3 characters.').max(120),
  description: z.string().trim().min(20, 'Tell us a bit more (at least 20 characters).').max(2000),
  contact_phone: z.string().trim().regex(/^\+?[0-9 ]{8,20}$/, 'Enter a valid phone number.'),
  address: z.string().trim().min(3, 'Enter your business address.').max(255),
  city: z.string().trim().min(2, 'Enter the city.').max(120),
  accept_seller_terms: z.boolean().refine((v) => v, 'You must accept the seller terms.'),
})
type Values = z.infer<typeof schema>

export default function BecomeSellerPage() {
  const user = useAuthStore((s) => s.user)!
  const { data, loading, reload } = useAsync(() => sellerService.application(), [])
  const [reapplying, setReapplying] = useState(false)
  const refreshAuth = useAuthStore((s) => s.refresh)

  // Approved since the session was loaded: refresh roles/store so the seller center unlocks.
  useEffect(() => {
    if (data?.status === 'approved' && !user.is_seller) void refreshAuth()
  }, [data?.status, user.is_seller, refreshAuth])

  if (loading && data === undefined) return <FullPageSpinner />

  const app = data ?? null
  const showForm = !user.is_seller && (!app || (app.status === 'rejected' && reapplying))

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid gap-10 lg:grid-cols-[1fr_22rem]">
        <div>
          <p className="text-sm font-medium text-brand-600">Sell on NegoMarket</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Open your store</h1>
          <p className="mt-2 text-ink-muted">Use your current account. Once an administrator approves your application, you can access the seller center.</p>

          <div className="mt-8">
            {user.is_seller ? (
              <StatusCard icon={CheckCircle2} tone="success" title="Your store is active" body={`${user.store?.name} is live.`} action={<Link to="/seller" className="text-sm font-medium text-brand-600">Open seller center →</Link>} />
            ) : showForm ? (
              <ApplicationForm onSubmitted={() => { setReapplying(false); reload() }} previous={app} />
            ) : app?.status === 'pending' ? (
              <StatusCard icon={Clock} tone="warning" title="Application under review" body={`“${app.business_name}” was submitted on ${formatDate(app.created_at)}. We will email you when it has been reviewed.`} />
            ) : app?.status === 'rejected' ? (
              <StatusCard icon={XCircle} tone="danger" title="Application not approved" body={app.admin_notes ?? ''} action={<Button variant="secondary" onClick={() => setReapplying(true)}>Update and re-apply</Button>} />
            ) : app?.status === 'approved' ? (
              <StatusCard icon={CheckCircle2} tone="success" title="Approved" body="Your store has been created." action={<Link to="/seller" className="text-sm font-medium text-brand-600">Open seller center →</Link>} />
            ) : null}
          </div>
        </div>

        <aside className="space-y-4">
          {[
            { icon: Store, t: 'Your own storefront', d: 'Logo, banner and a public store page.' },
            { icon: Handshake, t: 'Negotiate on your terms', d: 'Set a private minimum price per product.' },
            { icon: Truck, t: 'Cash on Delivery', d: 'Track COD collection per order.' },
            { icon: ShieldCheck, t: 'Reviewed sellers', d: 'Every store is approved by our team.' },
            { icon: PackagePlus, t: 'Simple catalog tools', d: 'Variants, images and inventory history.' },
          ].map(({ icon: Icon, t, d }) => (
            <div key={t} className="flex gap-3 rounded-2xl border border-line bg-surface p-4">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600"><Icon className="size-4.5" aria-hidden /></span>
              <div><p className="text-sm font-semibold">{t}</p><p className="text-sm text-ink-muted">{d}</p></div>
            </div>
          ))}
        </aside>
      </div>
    </div>
  )
}

function StatusCard({ icon: Icon, tone, title, body, action }: { icon: typeof Clock; tone: 'success' | 'warning' | 'danger'; title: string; body: string; action?: ReactNode }) {
  const tones = { success: 'bg-success-50 text-success-600', warning: 'bg-warning-50 text-warning-600', danger: 'bg-danger-50 text-danger-600' }
  return (
    <Card>
      <CardBody className="flex gap-4">
        <span className={`grid size-11 shrink-0 place-items-center rounded-2xl ${tones[tone]}`}><Icon className="size-5" aria-hidden /></span>
        <div className="flex-1">
          <p className="font-semibold">{title}</p>
          <p className="mt-1 text-sm text-ink-muted">{body}</p>
          {action && <div className="mt-4">{action}</div>}
        </div>
      </CardBody>
    </Card>
  )
}

function ApplicationForm({ onSubmitted, previous }: { onSubmitted: () => void; previous: StoreApplication | null }) {
  const [formError, setFormError] = useState<string | null>(null)
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      business_name: previous?.business_name ?? '', description: previous?.description ?? '', contact_phone: previous?.contact_phone ?? '',
      address: previous?.address ?? '', city: previous?.city ?? '', accept_seller_terms: false,
    },
  })
  const onSubmit = handleSubmit(async (v) => {
    setFormError(null)
    try {
      await sellerService.apply(v)
      toast.success('Application submitted. We will review it shortly.')
      onSubmitted()
    } catch (e) {
      setFormError(applyServerErrors(e, setError, ['business_name', 'description', 'contact_phone', 'address', 'city', 'accept_seller_terms']))
    }
  })
  return (
    <Card>
      <CardBody>
        {previous?.status === 'rejected' && <Alert tone="warning" title="Previous feedback" className="mb-5">{previous.admin_notes}</Alert>}
        <form onSubmit={onSubmit} noValidate className="grid gap-5 sm:grid-cols-2">
          {formError && <Alert tone="danger" className="sm:col-span-2">{formError}</Alert>}
          <div className="sm:col-span-2"><Input label="Business / store name" required error={errors.business_name?.message} {...register('business_name')} /></div>
          <div className="sm:col-span-2"><Textarea label="What will you sell?" required rows={4} error={errors.description?.message} {...register('description')} /></div>
          <Input label="Contact phone" type="tel" required error={errors.contact_phone?.message} {...register('contact_phone')} />
          <Input label="City" required error={errors.city?.message} {...register('city')} />
          <div className="sm:col-span-2"><Input label="Business address" required error={errors.address?.message} {...register('address')} /></div>
          <div className="sm:col-span-2"><Checkbox label="I agree to the seller terms: accurate listings, honoring accepted offers, and Cash on Delivery handling." error={errors.accept_seller_terms?.message} {...register('accept_seller_terms')} /></div>
          <div className="sm:col-span-2"><Button type="submit" size="lg" loading={isSubmitting}>Submit application</Button></div>
        </form>
      </CardBody>
    </Card>
  )
}
