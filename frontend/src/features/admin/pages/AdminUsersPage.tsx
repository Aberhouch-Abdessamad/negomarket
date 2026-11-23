import { Search, UserRound } from 'lucide-react'
import { useState } from 'react'
import { Alert, Badge, Button, ConfirmDialog, EmptyState, Input, Modal, Pagination, Select, Skeleton, Table, TableWrap, Tabs, Td, Th } from '@/components/ui'
import { useAsync } from '@/hooks/useAsync'
import { ApiError } from '@/services/api/types'
import { toast } from '@/store/toastStore'
import { formatDate } from '@/utils/format'
import { adminService } from '../adminService'
import { UserStatusBadge } from '../components/AdminBadges'
import type { AdminUser } from '../types'

type StatusTab = '' | 'active' | 'suspended'
type RoleFilter = '' | 'customer' | 'seller' | 'admin'

export default function AdminUsersPage() {
  const [tab, setTab] = useState<StatusTab>('')
  const [role, setRole] = useState<RoleFilter>('')
  const [search, setSearch] = useState('')
  const [applied, setApplied] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<AdminUser | null>(null)
  const [confirm, setConfirm] = useState<AdminUser | null>(null)
  const [busy, setBusy] = useState(false)

  const { data, error, loading, reload } = useAsync(
    () => adminService.users({ status: tab || undefined, role: role || undefined, q: applied || undefined, page }),
    [tab, role, applied, page],
  )

  async function changeStatus(user: AdminUser) {
    const next = user.status === 'suspended' ? 'active' : 'suspended'
    setBusy(true)
    try {
      await adminService.updateUserStatus(user.id, next)
      toast.success(next === 'suspended' ? `${user.name} suspended.` : `${user.name} restored.`)
      setConfirm(null)
      if (selected?.id === user.id) setSelected(null)
      reload()
    } catch (e) {
      toast.error(e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : 'Could not update the account.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Users</h1>
        <p className="mt-1 text-sm text-ink-muted">Every customer, seller and administrator account on the platform.</p>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <Tabs
          label="Account status"
          value={tab}
          onChange={(value) => { setTab(value); setPage(1) }}
          items={[{ value: '', label: 'All' }, { value: 'active', label: 'Active' }, { value: 'suspended', label: 'Suspended' }]}
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select
            aria-label="Filter by role"
            value={role}
            onChange={(e) => { setRole(e.target.value as RoleFilter); setPage(1) }}
            options={[{ value: '', label: 'All roles' }, { value: 'customer', label: 'Customers' }, { value: 'seller', label: 'Sellers' }, { value: 'admin', label: 'Administrators' }]}
            className="sm:w-44"
          />
          <form
            className="flex gap-2"
            onSubmit={(e) => { e.preventDefault(); setApplied(search.trim()); setPage(1) }}
          >
            <Input
              aria-label="Search accounts"
              placeholder="Name, email or phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 sm:w-64"
              trailing={<Search className="size-4 text-ink-subtle" aria-hidden />}
            />
            <Button type="submit" variant="secondary">Search</Button>
          </form>
        </div>
      </div>

      {error && <Alert tone="danger">{error.message}</Alert>}

      {loading && !data ? (
        <Skeleton className="h-72 rounded-2xl" />
      ) : data?.data.length === 0 ? (
        <EmptyState icon={UserRound} title="No accounts found" message="Try a different search, role or status." />
      ) : (
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>Account</Th>
                <Th>Roles</Th>
                <Th>Store</Th>
                <Th>Activity</Th>
                <Th>Joined</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {data?.data.map((user) => (
                <tr key={user.id} className="hover:bg-canvas/40">
                  <Td>
                    <button type="button" className="text-left font-medium hover:text-brand-700" onClick={() => setSelected(user)}>
                      {user.name}
                    </button>
                    <span className="block text-xs text-ink-subtle">{user.email}</span>
                  </Td>
                  <Td>
                    <span className="flex flex-wrap gap-1">
                      {user.roles.length > 0 ? user.roles.map((r) => <Badge key={r} tone={r === 'admin' ? 'brand' : 'neutral'}>{r}</Badge>) : '—'}
                    </span>
                  </Td>
                  <Td>{user.store?.name ?? '—'}</Td>
                  <Td className="text-xs text-ink-muted">
                    {user.orders_count ?? 0} orders · {user.negotiations_count ?? 0} negotiations · {user.reviews_count ?? 0} reviews
                  </Td>
                  <Td className="whitespace-nowrap text-xs text-ink-muted">{user.created_at ? formatDate(user.created_at) : '—'}</Td>
                  <Td><UserStatusBadge status={user.status} label={user.status_label} /></Td>
                  <Td className="text-right">
                    <div className="inline-flex gap-1.5">
                      <Button size="sm" variant="secondary" onClick={() => setSelected(user)}>View</Button>
                      {!user.roles.includes('admin') && (
                        <Button size="sm" variant={user.status === 'suspended' ? 'primary' : 'danger'} onClick={() => setConfirm(user)}>
                          {user.status === 'suspended' ? 'Activate' : 'Suspend'}
                        </Button>
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      )}

      {data && <Pagination page={data.meta.current_page} lastPage={data.meta.last_page} onChange={setPage} />}

      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected?.name ?? 'Account'}
        description={selected?.email}
        footer={<Button variant="secondary" onClick={() => setSelected(null)}>Close</Button>}
      >
        {selected && (
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <UserStatusBadge status={selected.status} label={selected.status_label} />
              {selected.roles.map((r) => <Badge key={r} tone={r === 'admin' ? 'brand' : 'neutral'}>{r}</Badge>)}
              {selected.email_verified ? <Badge tone="success">email verified</Badge> : <Badge tone="warning">email unverified</Badge>}
            </div>
            <dl className="grid gap-3 sm:grid-cols-2">
              <Field label="Phone" value={selected.phone ?? 'Not provided'} />
              <Field label="Joined" value={selected.created_at ? formatDate(selected.created_at) : '—'} />
              <Field label="Last seen" value={selected.last_seen_at ? formatDate(selected.last_seen_at) : 'Never'} />
              <Field label="Store" value={selected.store ? `${selected.store.name} (${selected.store.status})` : 'No store'} />
              <Field label="Orders" value={String(selected.orders_count ?? 0)} />
              <Field label="Negotiations" value={String(selected.negotiations_count ?? 0)} />
              <Field label="Reviews" value={String(selected.reviews_count ?? 0)} />
            </dl>
            {!selected.roles.includes('admin') && (
              <div className="flex justify-end border-t border-line pt-4">
                <Button variant={selected.status === 'suspended' ? 'primary' : 'danger'} onClick={() => setConfirm(selected)}>
                  {selected.status === 'suspended' ? 'Reactivate account' : 'Suspend account'}
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.status === 'suspended' ? 'Reactivate this account?' : 'Suspend this account?'}
        message={
          confirm?.status === 'suspended'
            ? 'The account can sign in and use the marketplace again.'
            : 'All active sessions are revoked immediately. The account cannot sign in until an administrator restores it.'
        }
        confirmLabel={confirm?.status === 'suspended' ? 'Reactivate' : 'Suspend'}
        tone={confirm?.status === 'suspended' ? 'primary' : 'danger'}
        loading={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={() => { if (confirm) void changeStatus(confirm) }}
      />
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">{label}</dt>
      <dd className="mt-0.5">{value}</dd>
    </div>
  )
}
