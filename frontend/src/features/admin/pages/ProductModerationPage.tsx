import { Check, ExternalLink, PackageCheck, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { Alert, Badge, Button, Card, CardBody, EmptyState, Modal, Pagination, Skeleton, Textarea } from '@/components/ui'
import type { SellerProduct } from '@/features/seller/types'
import { useAsync } from '@/hooks/useAsync'
import { ApiError } from '@/services/api/types'
import { toast } from '@/store/toastStore'
import { formatPrice } from '@/utils/format'
import { adminService } from '../adminService'

export default function ProductModerationPage() {
  const [page, setPage] = useState(1)
  const [rejecting, setRejecting] = useState<SellerProduct | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState<number | null>(null)
  const { data, loading, error, reload } = useAsync(() => adminService.moderationQueue(page), [page])

  async function act(id: number, fn: () => Promise<unknown>, ok: string) {
    setBusy(id)
    try {
      await fn()
      toast.success(ok)
      setRejecting(null)
      setReason('')
      reload()
    } catch (e) {
      toast.error(e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : 'Action failed.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Product moderation</h1>
        <p className="mt-1 text-sm text-ink-muted">{data ? `${data.meta.total} products awaiting review` : 'Approve products before they go live.'}</p>
      </div>
      {error && (
        <Alert
          tone="danger"
          title="Could not load the moderation queue"
          action={<Button size="sm" variant="secondary" onClick={reload}>Retry</Button>}
        >
          {error.message}
        </Alert>
      )}
      {loading && !data ? <Skeleton className="h-48" /> : data?.data.length === 0 ? (
        <EmptyState icon={PackageCheck} title="Queue is empty" message="No products are waiting for review." />
      ) : (
        <ul className="space-y-4">
          {data?.data.map((p) => (
            <li key={p.id}>
              <Card>
                <CardBody className="flex flex-col gap-5 md:flex-row">
                  <div className="flex gap-2 md:w-64 md:shrink-0">
                    {(p.images ?? []).slice(0, 3).map((img) => <img key={img.id} src={img.thumbnail_url} alt="" className="size-20 rounded-xl object-cover" />)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-lg font-semibold">{p.name}</p>
                    <p className="text-sm text-ink-muted">{p.store?.name} · {p.category?.name} · SKU {p.sku}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge tone="neutral">{formatPrice(p.price)}</Badge>
                      <Badge tone="neutral">Stock {p.stock_quantity}</Badge>
                      {p.allow_negotiation && <Badge tone="brand">Negotiation on</Badge>}
                      {(p.variants?.length ?? 0) > 0 && <Badge tone="neutral">{p.variants?.length} variants</Badge>}
                    </div>
                    <p className="mt-3 line-clamp-3 text-sm text-ink-muted">{p.description}</p>
                    {p.store && <Link to={`/stores/${p.store.slug}`} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand-600">Store page <ExternalLink className="size-3" aria-hidden /></Link>}
                  </div>
                  <div className="flex gap-2 md:flex-col">
                    <Button leftIcon={<Check className="size-4" />} loading={busy === p.id} onClick={() => void act(p.id, () => adminService.approveProduct(p.id), `“${p.name}” is now live.`)}>Approve</Button>
                    <Button variant="secondary" leftIcon={<X className="size-4" />} onClick={() => setRejecting(p)}>Reject</Button>
                  </div>
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      )}
      {data && <Pagination page={data.meta.current_page} lastPage={data.meta.last_page} onChange={setPage} />}
      <Modal open={rejecting !== null} onClose={() => setRejecting(null)} title={`Reject “${rejecting?.name}”`} description="The seller sees this reason and can fix and resubmit."
        footer={<><Button variant="secondary" onClick={() => setRejecting(null)}>Cancel</Button><Button variant="danger" disabled={reason.trim().length < 5} loading={busy === rejecting?.id} onClick={() => rejecting && void act(rejecting.id, () => adminService.rejectProduct(rejecting.id, reason), 'Product rejected.')}>Reject product</Button></>}>
        <Textarea label="Reason" required value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={255} />
      </Modal>
    </div>
  )
}
