import { RotateCcw, Save, Settings2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Alert, Button, Card, CardBody, CardHeader, Input, Skeleton, Switch } from '@/components/ui'
import { useAsync } from '@/hooks/useAsync'
import { ApiError } from '@/services/api/types'
import { toast } from '@/store/toastStore'
import { adminService } from '../adminService'
import type { PlatformSetting } from '../types'

type Draft = Record<string, string | boolean>

interface FieldMeta {
  label: string
  description: string
  kind: 'number' | 'boolean' | 'text'
  step?: string
  suffix?: string
}

const FIELDS: Record<string, FieldMeta> = {
  'negotiation.offer_expiry_hours': { label: 'Offer expiry (hours)', description: 'How long a pending price offer stays valid.', kind: 'number' },
  'negotiation.expiry_days': { label: 'Negotiation lifetime (days)', description: 'Threads close automatically after this many days of inactivity.', kind: 'number' },
  'negotiation.accepted_checkout_hours': { label: 'Accepted offer checkout window (hours)', description: 'Time a customer has to check out an accepted offer.', kind: 'number' },
  'negotiation.max_open_per_customer': { label: 'Maximum open negotiations per customer', description: 'Caps how many active threads one buyer can hold.', kind: 'number' },
  'checkout.currency': { label: 'Currency', description: 'ISO currency code shown across the marketplace.', kind: 'text' },
  'checkout.default_shipping_cost': { label: 'Default shipping cost', description: 'Fallback shipping fee when a store has no rate.', kind: 'number', step: '0.01', suffix: 'MAD' },
  'reviews.require_moderation': { label: 'Require review moderation', description: 'New reviews wait for administrator approval.', kind: 'boolean' },
  'products.require_moderation': { label: 'Require product moderation', description: 'New and edited products wait for administrator approval.', kind: 'boolean' },
  'products.max_images': { label: 'Maximum product images', description: 'How many images a seller can attach to one product.', kind: 'number' },
}

const GROUPS: { key: string; title: string; description: string }[] = [
  { key: 'negotiation', title: 'Negotiation', description: 'Offer windows and thread limits.' },
  { key: 'checkout', title: 'Checkout', description: 'Currency and default shipping.' },
  { key: 'products', title: 'Products', description: 'Catalog moderation and media limits.' },
  { key: 'reviews', title: 'Reviews', description: 'Customer review publishing rules.' },
]

const toDraft = (settings: PlatformSetting[]): Draft =>
  Object.fromEntries(
    settings.map((setting) => [
      setting.key,
      typeof setting.value === 'boolean' ? setting.value : String(setting.value ?? ''),
    ]),
  )

/** Platform settings editor. Only changed keys are sent to the API. */
export default function AdminSettingsPage() {
  const { data, error, loading, reload } = useAsync(() => adminService.settings(), [])
  const [draft, setDraft] = useState<Draft>({})
  const [saved, setSaved] = useState<Draft>({})
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!data) return
    const next = toDraft(data)
    setDraft(next)
    setSaved(next)
  }, [data])

  const dirty = data?.filter((setting) => draft[setting.key] !== saved[setting.key]) ?? []

  function update(key: string, value: string | boolean) {
    setDraft((current) => ({ ...current, [key]: value }))
    setFormError(null)
  }

  function restoreDefault(setting: PlatformSetting) {
    update(setting.key, typeof setting.default === 'boolean' ? setting.default : String(setting.default ?? ''))
  }

  async function save() {
    if (dirty.length === 0) return
    const payload: Record<string, unknown> = {}

    for (const setting of dirty) {
      const meta = FIELDS[setting.key]
      const raw = draft[setting.key]

      if (meta?.kind === 'boolean') {
        payload[setting.key] = Boolean(raw)
        continue
      }

      if (meta?.kind === 'number') {
        const value = Number(raw)
        if (String(raw).trim() === '' || !Number.isFinite(value) || value < 0) {
          setFormError(`${meta.label} must be a number of zero or more.`)
          return
        }
        payload[setting.key] = meta.step ? value : Math.round(value)
        continue
      }

      const value = String(raw ?? '').trim()
      if (value === '') {
        setFormError(`${meta?.label ?? setting.key} cannot be empty.`)
        return
      }
      payload[setting.key] = value
    }

    setSaving(true)
    setFormError(null)
    try {
      const updated = await adminService.updateSettings(payload)
      const next = toDraft(updated)
      setDraft(next)
      setSaved(next)
      toast.success('Platform settings saved.')
      reload()
    } catch (e) {
      toast.error(e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : 'Could not save the settings.')
    } finally {
      setSaving(false)
    }
  }

  if (loading && !data) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-9 w-48" />
        {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-56 rounded-2xl" />)}
      </div>
    )
  }

  if (error || !data) {
    return <Alert tone="danger" title="Settings unavailable">{error?.message ?? 'The settings could not be loaded.'}</Alert>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="inline-flex items-center gap-2 text-2xl font-extrabold tracking-tight">
            <Settings2 className="size-6 text-brand-600" aria-hidden /> Platform settings
          </h1>
          <p className="mt-1 text-sm text-ink-muted">Marketplace-wide defaults. Changes are recorded in the activity log.</p>
        </div>
        <div className="flex items-center gap-2">
          {dirty.length > 0 && <span className="text-xs text-ink-subtle">{dirty.length} unsaved {dirty.length === 1 ? 'change' : 'changes'}</span>}
          <Button onClick={() => void save()} disabled={dirty.length === 0} loading={saving} leftIcon={<Save className="size-4" />}>
            Save changes
          </Button>
        </div>
      </div>

      {formError && <Alert tone="danger">{formError}</Alert>}

      {GROUPS.map((group) => {
        const settings = data.filter((setting) => setting.key.startsWith(`${group.key}.`))
        if (settings.length === 0) return null

        return (
          <Card key={group.key}>
            <CardHeader>
              <div>
                <h2 className="font-semibold">{group.title}</h2>
                <p className="text-xs text-ink-muted">{group.description}</p>
              </div>
            </CardHeader>
            <CardBody className="divide-y divide-line pt-2">
              {settings.map((setting) => {
                const meta = FIELDS[setting.key] ?? { label: setting.key, description: '', kind: 'text' as const }
                const value = draft[setting.key]
                const changed = value !== saved[setting.key]

                return (
                  <div key={setting.key} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_18rem] sm:items-start">
                    <div>
                      <p className="text-sm font-medium">
                        {meta.label}
                        {changed && <span className="ml-2 rounded-full bg-warning-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning-600">Edited</span>}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-muted">{meta.description}</p>
                      <p className="mt-1.5 font-mono text-[11px] text-ink-subtle">{setting.key} · default {String(setting.default)}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      {meta.kind === 'boolean' ? (
                        <div className="w-full rounded-xl border border-line px-3 py-2.5">
                          <Switch
                            checked={Boolean(value)}
                            onChange={(next) => update(setting.key, next)}
                            label={value ? 'Enabled' : 'Disabled'}
                          />
                        </div>
                      ) : (
                        <>
                          <Input
                            aria-label={meta.label}
                            type={meta.kind === 'number' ? 'number' : 'text'}
                            min={meta.kind === 'number' ? 0 : undefined}
                            step={meta.step}
                            value={String(value ?? '')}
                            onChange={(e) => update(setting.key, e.target.value)}
                            trailing={meta.suffix ? <span className="text-xs text-ink-subtle">{meta.suffix}</span> : undefined}
                            className="h-10"
                          />
                          <Button size="sm" variant="ghost" title="Restore the default value" onClick={() => restoreDefault(setting)}>
                            <RotateCcw className="size-3.5" aria-hidden />
                            <span className="sr-only">Restore default for {meta.label}</span>
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </CardBody>
          </Card>
        )
      })}
    </div>
  )
}
