import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Alert, Button, Checkbox, Input, Modal } from '@/components/ui'
import { type AddressValues, addressSchema } from '@/features/auth/schemas'
import { applyServerErrors } from '@/utils/forms'
import { type Address, type AddressInput, accountService } from '../accountService'

const FIELDS = ['label', 'full_name', 'phone', 'address_line1', 'address_line2', 'city', 'region', 'postal_code', 'is_default'] as const

function toValues(address: Address | null): AddressValues {
  return {
    label: address?.label ?? '',
    full_name: address?.full_name ?? '',
    phone: address?.phone ?? '',
    address_line1: address?.address_line1 ?? '',
    address_line2: address?.address_line2 ?? '',
    city: address?.city ?? '',
    region: address?.region ?? '',
    postal_code: address?.postal_code ?? '',
    is_default: address?.is_default ?? false,
  }
}

interface Props {
  open: boolean
  address: Address | null
  onClose: () => void
  onSaved: (a: Address) => void
}

export function AddressFormModal({ open, address, onClose, onSaved }: Props) {
  return (
    <Modal open={open} onClose={onClose} title={address ? 'Edit address' : 'Add address'} description="Used as your delivery address at checkout.">
      {/* Mounted only while open, so every opening starts with fresh form state. */}
      {open && <AddressForm address={address} onCancel={onClose} onSaved={onSaved} />}
    </Modal>
  )
}

function AddressForm({ address, onCancel, onSaved }: { address: Address | null; onCancel: () => void; onSaved: (a: Address) => void }) {
  const [formError, setFormError] = useState<string | null>(null)
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<AddressValues>({
    resolver: zodResolver(addressSchema),
    defaultValues: toValues(address),
  })

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    const payload = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== '')) as AddressInput
    try {
      onSaved(address ? await accountService.updateAddress(address.id, payload) : await accountService.createAddress(payload))
    } catch (error) {
      setFormError(applyServerErrors(error, setError, FIELDS))
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
      {formError && <Alert tone="danger" className="sm:col-span-2">{formError}</Alert>}
      <Input label="Label" placeholder="Home, Work…" error={errors.label?.message} {...register('label')} />
      <Input label="Recipient name" required autoComplete="name" error={errors.full_name?.message} {...register('full_name')} />
      <Input label="Phone" required type="tel" autoComplete="tel" error={errors.phone?.message} {...register('phone')} />
      <Input label="City" required autoComplete="address-level2" error={errors.city?.message} {...register('city')} />
      <div className="sm:col-span-2">
        <Input label="Street address" required autoComplete="address-line1" error={errors.address_line1?.message} {...register('address_line1')} />
      </div>
      <div className="sm:col-span-2">
        <Input label="Apartment, building, floor" autoComplete="address-line2" error={errors.address_line2?.message} {...register('address_line2')} />
      </div>
      <Input label="Region" autoComplete="address-level1" error={errors.region?.message} {...register('region')} />
      <Input label="Postal code" autoComplete="postal-code" error={errors.postal_code?.message} {...register('postal_code')} />
      <div className="sm:col-span-2">
        <Checkbox label="Use as my default delivery address" {...register('is_default')} />
      </div>
      <div className="-mx-5 -mb-4 mt-2 flex justify-end gap-2 border-t border-line px-5 py-3 sm:col-span-2">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={isSubmitting}>
          Save address
        </Button>
      </div>
    </form>
  )
}
