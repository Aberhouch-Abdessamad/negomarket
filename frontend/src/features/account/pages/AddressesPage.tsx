import { MapPin, Pencil, Plus, Star, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Alert, Badge, Button, Card, CardBody, ConfirmDialog, Skeleton } from '@/components/ui'
import { ApiError } from '@/services/api/types'
import { toast } from '@/store/toastStore'
import { type Address, accountService } from '../accountService'
import { AddressFormModal } from '../components/AddressFormModal'

export default function AddressesPage() {
  const [addresses, setAddresses] = useState<Address[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Address | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [deleting, setDeleting] = useState<Address | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      setAddresses(await accountService.addresses())
      setError(null)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load addresses.')
    }
  }, [])

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    void load()
  }, [load])

  async function makeDefault(a: Address) {
    await accountService.setDefaultAddress(a.id)
    toast.success('Default address updated.')
    await load()
  }

  async function confirmDelete() {
    if (!deleting) return
    setBusy(true)
    try {
      await accountService.deleteAddress(deleting.id)
      toast.success('Address deleted.')
      setDeleting(null)
      await load()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-semibold">Delivery addresses</h2>
          <p className="mt-1 text-sm text-ink-muted">Save up to 10 addresses for faster checkout.</p>
        </div>
        <Button
          leftIcon={<Plus className="size-4" />}
          onClick={() => {
            setEditing(null)
            setFormOpen(true)
          }}
          disabled={(addresses?.length ?? 0) >= 10}
        >
          Add address
        </Button>
      </div>

      {error && <Alert tone="danger" className="mt-6">{error}</Alert>}

      {addresses === null && !error && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      )}

      {addresses?.length === 0 && (
        <Card className="mt-6">
          <CardBody className="flex flex-col items-center py-12 text-center">
            <span className="grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-600">
              <MapPin className="size-6" aria-hidden />
            </span>
            <p className="mt-4 font-medium">No addresses yet</p>
            <p className="mt-1 text-sm text-ink-muted">Add a delivery address to speed up checkout.</p>
          </CardBody>
        </Card>
      )}

      {addresses && addresses.length > 0 && (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {addresses.map((a) => (
            <li key={a.id}>
              <Card className={a.is_default ? 'ring-2 ring-brand-500' : ''}>
                <CardBody className="flex h-full flex-col">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{a.label || 'Address'}</p>
                    {a.is_default && <Badge tone="brand">Default</Badge>}
                  </div>
                  <address className="mt-2 text-sm not-italic leading-relaxed text-ink-muted">
                    {a.full_name} · {a.phone}
                    <br />
                    {a.address_line1}
                    {a.address_line2 && <>, {a.address_line2}</>}
                    <br />
                    {a.postal_code && `${a.postal_code} `}
                    {a.city}
                    {a.region && `, ${a.region}`} · {a.country}
                  </address>
                  <div className="mt-4 flex flex-wrap gap-1 border-t border-line pt-3">
                    <Button variant="ghost" size="sm" leftIcon={<Pencil className="size-3.5" />} onClick={() => { setEditing(a); setFormOpen(true) }}>
                      Edit
                    </Button>
                    {!a.is_default && (
                      <Button variant="ghost" size="sm" leftIcon={<Star className="size-3.5" />} onClick={() => void makeDefault(a)}>
                        Set as default
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="ml-auto text-danger-600 hover:bg-danger-50 hover:text-danger-600" leftIcon={<Trash2 className="size-3.5" />} onClick={() => setDeleting(a)}>
                      Delete
                    </Button>
                  </div>
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <AddressFormModal
        open={formOpen}
        address={editing}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false)
          toast.success(editing ? 'Address updated.' : 'Address saved.')
          void load()
        }}
      />
      <ConfirmDialog
        open={deleting !== null}
        title="Delete address?"
        message={deleting ? `"${deleting.label || deleting.address_line1}" will be removed from your account.` : ''}
        confirmLabel="Delete"
        loading={busy}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}
