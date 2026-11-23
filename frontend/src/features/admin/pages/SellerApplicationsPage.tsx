import { Check, ClipboardCheck, X } from 'lucide-react'
import { useState } from 'react'
import { Alert, Badge, type BadgeTone, Button, Card, CardBody, EmptyState, Modal, Pagination, Skeleton, Tabs, Textarea } from '@/components/ui'
import type { StoreApplication } from '@/features/seller/types'
import { useAsync } from '@/hooks/useAsync'
import { ApiError } from '@/services/api/types'
import { toast } from '@/store/toastStore'
import { formatDate } from '@/utils/format'
import { adminService } from '../adminService'

const tone: Record<StoreApplication['status'], BadgeTone> = { pending: 'warning', approved: 'success', rejected: 'danger' }

export default function SellerApplicationsPage() {
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected' | ''>('pending')
  const [page, setPage] = useState(1)
  const [rejecting, setRejecting] = useState<StoreApplication | null>(null)
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState<number | null>(null)
  const { data, loading, error, reload } = useAsync(() => adminService.applications({ status: status || undefined, page }), [status, page])

  async function act(id: number, fn: () => Promise<unknown>, ok: string) {
    setBusy(id)
    try {
      await fn()
      toast.success(ok)
      setRejecting(null)
      setNotes('')
      reload()
    } catch (e) {
      toast.error(e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : 'Action failed.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Seller applications</h1>
          <p className="mt-1 text-sm text-ink-muted">{data ? `${data.meta.pending_count} awaiting review` : 'Review customers who want to sell.'}</p>
        </div>
        <Tabs label="Status" value={status} onChange={(v) => { setStatus(v); setPage(1) }} items={[{ value: 'pending', label: 'Pending' }, { value: 'approved', label: 'Approved' }, { value: 'rejected', label: 'Rejected' }, { value: '', label: 'All' }]} />
      </div>
      {error && <Alert tone="danger">{error.message}</Alert>}
      {loading && !data ? <Skeleton className="h-48" /> : data?.data.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="Nothing here" message="No applications with this status." />
      ) : (
        <ul className="space-y-4">
          {data?.data.map((a) => (
            <li key={a.id}>
              <Card>
                <CardBody>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2"><p className="text-lg font-semibold">{a.business_name}</p><Badge tone={tone[a.status]} className="capitalize">{a.status}</Badge></div>
                      <p className="mt-0.5 text-sm text-ink-muted">{a.applicant?.name} · {a.applicant?.email} {a.applicant && !a.applicant.email_verified && <Badge tone="warning">email unverified</Badge>}</p>
                      <p className="text-xs text-ink-subtle">Submitted {formatDate(a.created_at)} · Member since {a.applicant && formatDate(a.applicant.member_since)}</p>
                    </div>
                    {a.status === 'pending' && (
                      <div className="flex gap-2">
                        <Button variant="secondary" leftIcon={<X className="size-4" />} onClick={() => setRejecting(a)}>Reject</Button>
                        <Button leftIcon={<Check className="size-4" />} loading={busy === a.id} onClick={() => void act(a.id, () => adminService.approveApplication(a.id), `${a.business_name} approved.`)}>Approve</Button>
                      </div>
                    )}
                  </div>
                  <p className="mt-4 text-sm">{a.description}</p>
                  <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm text-ink-muted sm:grid-cols-3">
                    <div><dt className="inline text-ink-subtle">Phone: </dt><dd className="inline">{a.contact_phone}</dd></div>
                    <div className="sm:col-span-2"><dt className="inline text-ink-subtle">Address: </dt><dd className="inline">{a.address}, {a.city}</dd></div>
                  </dl>
                  {a.admin_notes && <p className="mt-3 rounded-xl bg-canvas p-3 text-sm"><span className="font-medium">Notes{a.reviewer ? ` (${a.reviewer})` : ''}: </span>{a.admin_notes}</p>}
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      )}
      {data && <Pagination page={data.meta.current_page} lastPage={data.meta.last_page} onChange={setPage} />}

      <Modal open={rejecting !== null} onClose={() => setRejecting(null)} title={`Reject “${rejecting?.business_name}”`} description="The applicant sees these notes and can re-apply."
        footer={<><Button variant="secondary" onClick={() => setRejecting(null)}>Cancel</Button><Button variant="danger" disabled={notes.trim().length < 5} loading={busy === rejecting?.id} onClick={() => rejecting && void act(rejecting.id, () => adminService.rejectApplication(rejecting.id, notes), 'Application rejected.')}>Reject application</Button></>}>
        <Textarea label="Reason" required value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} hint="At least 5 characters." />
      </Modal>
    </div>
  )
}
