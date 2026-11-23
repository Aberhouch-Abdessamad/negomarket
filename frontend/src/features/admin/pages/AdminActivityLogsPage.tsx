import { ScrollText, Search } from 'lucide-react'
import { useState } from 'react'
import { Alert, Button, EmptyState, Input, Pagination, Skeleton, Table, TableWrap, Td, Th } from '@/components/ui'
import { useAsync } from '@/hooks/useAsync'
import { formatDate } from '@/utils/format'
import { adminService } from '../adminService'

export default function AdminActivityLogsPage() {
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [action, setAction] = useState('')
  const [subjectType, setSubjectType] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)

  const { data, error, loading } = useAsync(
    () =>
      adminService.activityLogs({
        q: query || undefined,
        action: action.trim() || undefined,
        subject_type: subjectType.trim() || undefined,
        from: from || undefined,
        to: to || undefined,
        page,
      }),
    [query, action, subjectType, from, to, page],
  )

  function reset() {
    setSearch('')
    setQuery('')
    setAction('')
    setSubjectType('')
    setFrom('')
    setTo('')
    setPage(1)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Activity log</h1>
        <p className="mt-1 text-sm text-ink-muted">Immutable audit trail of administrative and marketplace actions.</p>
      </div>

      <form
        className="grid gap-2 rounded-2xl border border-line bg-surface p-4 sm:grid-cols-2 xl:grid-cols-6"
        onSubmit={(e) => { e.preventDefault(); setQuery(search.trim()); setPage(1) }}
      >
        <Input aria-label="Search by user" placeholder="User name or email" value={search} onChange={(e) => setSearch(e.target.value)} trailing={<Search className="size-4 text-ink-subtle" aria-hidden />} />
        <Input aria-label="Action" placeholder="Action (e.g. order.cancelled)" value={action} onChange={(e) => setAction(e.target.value)} />
        <Input aria-label="Subject type" placeholder="Subject (e.g. Order)" value={subjectType} onChange={(e) => setSubjectType(e.target.value)} />
        <Input aria-label="From date" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input aria-label="To date" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <div className="flex gap-2">
          <Button type="submit" className="flex-1">Filter</Button>
          <Button type="button" variant="secondary" onClick={reset}>Reset</Button>
        </div>
      </form>

      {error && <Alert tone="danger">{error.message}</Alert>}

      {loading && !data ? (
        <Skeleton className="h-72 rounded-2xl" />
      ) : data?.data.length === 0 ? (
        <EmptyState icon={ScrollText} title="No activity found" message="Try a different action, subject, user or date range." />
      ) : (
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Action</Th>
                <Th>User</Th>
                <Th>Subject</Th>
                <Th>IP</Th>
                <Th>Details</Th>
              </tr>
            </thead>
            <tbody>
              {data?.data.map((entry) => (
                <tr key={entry.id} className="align-top">
                  <Td className="whitespace-nowrap text-xs text-ink-muted">{entry.created_at ? formatDate(entry.created_at) : '—'}</Td>
                  <Td className="whitespace-nowrap font-mono text-xs">{entry.action}</Td>
                  <Td>
                    {entry.user ? (
                      <>
                        <p className="font-medium">{entry.user.name}</p>
                        <p className="text-xs text-ink-subtle">{entry.user.email}</p>
                      </>
                    ) : <span className="text-ink-subtle">System</span>}
                  </Td>
                  <Td className="text-xs text-ink-muted">
                    {entry.subject_type ?? '—'}
                    {entry.subject_id !== null && <span className="block text-ink-subtle">#{entry.subject_id}</span>}
                  </Td>
                  <Td className="font-mono text-xs text-ink-muted">{entry.ip_address ?? '—'}</Td>
                  <Td>
                    {entry.properties ? (
                      <details>
                        <summary className="cursor-pointer text-xs font-medium text-brand-700">View</summary>
                        <pre className="mt-1 max-w-xs overflow-x-auto rounded-lg bg-canvas p-2 text-[11px] text-ink-muted">{JSON.stringify(entry.properties, null, 2)}</pre>
                      </details>
                    ) : '—'}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      )}

      {data && <Pagination page={data.meta.current_page} lastPage={data.meta.last_page} onChange={setPage} />}
    </div>
  )
}
