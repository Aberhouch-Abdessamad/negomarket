import { zodResolver } from '@hookform/resolvers/zod'
import { Camera, ExternalLink, ImagePlus, MapPin, Pencil, Plus, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { z } from 'zod'
import { Alert, Badge, Button, Card, CardBody, Checkbox, ConfirmDialog, FullPageSpinner, Input, Modal, Select, Textarea } from '@/components/ui'
import { useAsync } from '@/hooks/useAsync'
import { ApiError } from '@/services/api/types'
import { useAuthStore } from '@/store/authStore'
import { toast } from '@/store/toastStore'
import { applyServerErrors } from '@/utils/forms'
import { sellerService } from '../sellerService'
import type { SellerStore, StoreAddress } from '../types'

const phone = z.string().trim().regex(/^\+?[0-9 ]{8,20}$/, 'Enter a valid phone number.').or(z.literal(''))
const storeSchema = z.object({
  name: z.string().trim().min(3, 'Use at least 3 characters.').max(120),
  description: z.string().max(2000).optional(),
  phone,
  email: z.string().trim().email('Enter a valid email.').or(z.literal('')),
  address: z.string().max(255).optional(),
  city: z.string().trim().min(2, 'Enter the city.').max(120),
})
type StoreValues = z.infer<typeof storeSchema>

const addressSchema = z.object({
  type: z.enum(['business', 'pickup']),
  label: z.string().max(64).optional(),
  contact_name: z.string().max(120).optional(),
  phone,
  address_line1: z.string().trim().min(3, 'Enter the street address.').max(255),
  address_line2: z.string().max(255).optional(),
  city: z.string().trim().min(2, 'Enter the city.').max(120),
  postal_code: z.string().max(20).optional(),
  is_default: z.boolean().optional(),
})
type AddressValues = z.infer<typeof addressSchema>

export default function StoreSettingsPage() {
  const { data, reload } = useAsync(() => sellerService.store(), [])
  if (!data) return <FullPageSpinner />
  return <StoreSettings key={data.id} store={data} reload={reload} />
}

function StoreSettings({ store: initial, reload }: { store: SellerStore; reload: () => void }) {
  const [store, setStore] = useState(initial)
  const [formError, setFormError] = useState<string | null>(null)
  const refreshAuth = useAuthStore((s) => s.refresh)
  const { register, handleSubmit, setError, reset, formState: { errors, isSubmitting, isDirty } } = useForm<StoreValues>({
    resolver: zodResolver(storeSchema),
    defaultValues: { name: initial.name, description: initial.description ?? '', phone: initial.phone ?? '', email: initial.email ?? '', address: initial.address ?? '', city: initial.city ?? '' },
  })

  const onSubmit = handleSubmit(async (v) => {
    setFormError(null)
    try {
      const saved = await sellerService.updateStore({ ...v, phone: v.phone || null, email: v.email || null })
      setStore(saved)
      reset({ name: saved.name, description: saved.description ?? '', phone: saved.phone ?? '', email: saved.email ?? '', address: saved.address ?? '', city: saved.city ?? '' })
      void refreshAuth()
      toast.success('Store updated.')
    } catch (e) {
      setFormError(applyServerErrors(e, setError, ['name', 'description', 'phone', 'email', 'address', 'city']))
    }
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">My store</h1>
          <p className="mt-1 text-sm text-ink-muted">How your store appears to customers.</p>
        </div>
        <Link to={`/stores/${store.slug}`} className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700">View public page <ExternalLink className="size-3.5" aria-hidden /></Link>
      </div>

      <StoreImages store={store} onChange={setStore} />

      <Card>
        <CardBody>
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-semibold">Store profile</h2>
            <Badge tone={store.status === 'active' ? 'success' : 'danger'} className="capitalize">{store.status}</Badge>
          </div>
          <form onSubmit={onSubmit} noValidate className="grid gap-5 sm:grid-cols-2">
            {formError && <Alert tone="danger" className="sm:col-span-2">{formError}</Alert>}
            <Input label="Store name" required error={errors.name?.message} {...register('name')} />
            <Input label="City" required error={errors.city?.message} {...register('city')} />
            <div className="sm:col-span-2"><Textarea label="Description" rows={4} error={errors.description?.message} {...register('description')} /></div>
            <Input label="Contact phone" type="tel" error={errors.phone?.message} {...register('phone')} />
            <Input label="Contact email" type="email" error={errors.email?.message} {...register('email')} />
            <div className="sm:col-span-2"><Input label="Address" error={errors.address?.message} {...register('address')} /></div>
            <p className="text-xs text-ink-subtle sm:col-span-2">Your store URL (/stores/{store.slug}) does not change when you rename the store.</p>
            <div className="flex justify-end sm:col-span-2"><Button type="submit" loading={isSubmitting} disabled={!isDirty}>Save changes</Button></div>
          </form>
        </CardBody>
      </Card>

      <Addresses addresses={store.addresses} reload={reload} />
    </div>
  )
}

function StoreImages({ store, onChange }: { store: SellerStore; onChange: (s: SellerStore) => void }) {
  const logo = useRef<HTMLInputElement>(null)
  const banner = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<'logo' | 'banner' | null>(null)

  async function upload(kind: 'logo' | 'banner', file?: File) {
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) return toast.error('Use a JPG, PNG or WebP image up to 5 MB.')
    setBusy(kind)
    try {
      onChange(await sellerService.uploadStoreImage(kind, file))
      toast.success(`${kind === 'logo' ? 'Logo' : 'Banner'} updated.`)
    } catch (e) {
      toast.error(e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : 'Upload failed.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="relative h-40 bg-brand-100 sm:h-48">
        {store.banner_url && <img src={store.banner_url} alt="" className="size-full object-cover" />}
        <Button size="sm" variant="secondary" className="absolute right-4 top-4" leftIcon={<ImagePlus className="size-4" />} loading={busy === 'banner'} onClick={() => banner.current?.click()}>Change banner</Button>
      </div>
      <CardBody className="flex items-end gap-4 pt-0">
        <div className="relative -mt-10 size-24 shrink-0 overflow-hidden rounded-2xl border-4 border-surface bg-canvas shadow-sm">
          {store.logo_url ? <img src={store.logo_url} alt="Store logo" className="size-full object-cover" /> : <span className="grid size-full place-items-center text-2xl font-semibold text-brand-600">{store.name[0]}</span>}
          <button type="button" onClick={() => logo.current?.click()} aria-label="Change logo" className="absolute inset-0 grid place-items-center bg-ink/50 text-white opacity-0 transition hover:opacity-100 focus:opacity-100">
            <Camera className="size-5" />
          </button>
        </div>
        <div className="pb-1 text-xs text-ink-subtle">Logo: square, min 128 px · Banner: wide, min 800×200 px · JPG/PNG/WebP up to 5 MB{busy === 'logo' && ' · Uploading logo…'}</div>
      </CardBody>
      <input ref={logo} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" aria-label="Upload logo" onChange={(e) => void upload('logo', e.target.files?.[0])} />
      <input ref={banner} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" aria-label="Upload banner" onChange={(e) => void upload('banner', e.target.files?.[0])} />
    </Card>
  )
}

function Addresses({ addresses, reload }: { addresses: StoreAddress[]; reload: () => void }) {
  const [editing, setEditing] = useState<StoreAddress | null | 'new'>(null)
  const [deleting, setDeleting] = useState<StoreAddress | null>(null)

  return (
    <Card>
      <CardBody>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Business &amp; pickup addresses</h2>
            <p className="mt-0.5 text-sm text-ink-muted">Used for order fulfilment. Not shown publicly.</p>
          </div>
          <Button size="sm" variant="secondary" leftIcon={<Plus className="size-4" />} onClick={() => setEditing('new')}>Add address</Button>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          {addresses.map((a) => (
            <li key={a.id} className="rounded-xl border border-line p-4">
              <div className="flex items-center gap-2">
                <MapPin className="size-4 text-brand-600" aria-hidden />
                <p className="font-medium">{a.label || (a.type === 'pickup' ? 'Pickup' : 'Business')}</p>
                <Badge tone="neutral" className="capitalize">{a.type}</Badge>
                {a.is_default && <Badge tone="brand">Default</Badge>}
              </div>
              <p className="mt-2 text-sm text-ink-muted">{a.address_line1}{a.address_line2 && `, ${a.address_line2}`}, {a.city}</p>
              {(a.contact_name || a.phone) && <p className="text-xs text-ink-subtle">{[a.contact_name, a.phone].filter(Boolean).join(' · ')}</p>}
              <div className="mt-3 flex gap-1">
                <Button size="sm" variant="ghost" leftIcon={<Pencil className="size-3.5" />} onClick={() => setEditing(a)}>Edit</Button>
                <Button size="sm" variant="ghost" className="text-danger-600 hover:bg-danger-50 hover:text-danger-600" leftIcon={<Trash2 className="size-3.5" />} onClick={() => setDeleting(a)}>Delete</Button>
              </div>
            </li>
          ))}
        </ul>
      </CardBody>
      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'Add address' : 'Edit address'}>
        {editing !== null && <AddressForm address={editing === 'new' ? null : editing} onDone={() => { setEditing(null); reload() }} />}
      </Modal>
      <ConfirmDialog open={deleting !== null} title="Delete address?" message="This address will be removed from your store." confirmLabel="Delete" onCancel={() => setDeleting(null)}
        onConfirm={async () => { if (deleting) { await sellerService.deleteAddress(deleting.id); toast.success('Address deleted.'); setDeleting(null); reload() } }} />
    </Card>
  )
}

function AddressForm({ address, onDone }: { address: StoreAddress | null; onDone: () => void }) {
  const [formError, setFormError] = useState<string | null>(null)
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<AddressValues>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      type: address?.type ?? 'pickup', label: address?.label ?? '', contact_name: address?.contact_name ?? '', phone: address?.phone ?? '',
      address_line1: address?.address_line1 ?? '', address_line2: address?.address_line2 ?? '', city: address?.city ?? '', postal_code: address?.postal_code ?? '', is_default: address?.is_default ?? false,
    },
  })
  const onSubmit = handleSubmit(async (v) => {
    try {
      await sellerService.saveAddress(Object.fromEntries(Object.entries(v).filter(([, x]) => x !== '')) as Partial<StoreAddress>, address?.id)
      toast.success('Address saved.')
      onDone()
    } catch (e) {
      setFormError(applyServerErrors(e, setError, ['type', 'label', 'contact_name', 'phone', 'address_line1', 'address_line2', 'city', 'postal_code']))
    }
  })
  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
      {formError && <Alert tone="danger" className="sm:col-span-2">{formError}</Alert>}
      <Select label="Type" options={[{ value: 'pickup', label: 'Pickup / warehouse' }, { value: 'business', label: 'Business' }]} {...register('type')} />
      <Input label="Label" placeholder="Main warehouse" {...register('label')} />
      <Input label="Contact name" {...register('contact_name')} />
      <Input label="Phone" type="tel" error={errors.phone?.message} {...register('phone')} />
      <div className="sm:col-span-2"><Input label="Street address" required error={errors.address_line1?.message} {...register('address_line1')} /></div>
      <Input label="City" required error={errors.city?.message} {...register('city')} />
      <Input label="Postal code" {...register('postal_code')} />
      <div className="sm:col-span-2"><Checkbox label="Default address for this type" {...register('is_default')} /></div>
      <div className="flex justify-end sm:col-span-2"><Button type="submit" loading={isSubmitting}>Save address</Button></div>
    </form>
  )
}
