import { Search, Store } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { Alert, Button, EmptyState, Pagination, Select, Skeleton } from '@/components/ui'
import { marketplaceService } from '@/features/marketplace/marketplaceService'
import { useAsync } from '@/hooks/useAsync'
import { StoreCard } from '../components/StoreCard'

export default function StoresPage() {
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState(params.get('q') ?? '')
  const page = Number(params.get('page') ?? 1)
  const city = params.get('city') ?? ''
  const sort = params.get('sort') ?? 'rating'

  const { data, loading, error, reload } = useAsync(() => marketplaceService.stores({ q: params.get('q') ?? undefined, city: city || undefined, sort, page }), [params.toString()])

  const set = (patch: Record<string, string>) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)))
      if (!('page' in patch)) next.delete('page')
      return next
    })

  return (
    <div className="mx-auto max-w-[90rem] px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Stores</h1>
      <p className="mt-1 text-ink-muted">Independent, approved sellers on NegoMarket.</p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <form className="relative flex-1" onSubmit={(e) => { e.preventDefault(); set({ q }) }}>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search stores" aria-label="Search stores" className="h-11 w-full rounded-xl border border-line bg-surface pl-10 pr-4 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100" />
        </form>
        <div className="grid grid-cols-2 gap-3 sm:w-96">
          <Select aria-label="City" value={city} placeholder="All cities" options={(data?.cities ?? []).map((c) => ({ value: c, label: c }))} onChange={(e) => set({ city: e.target.value })} />
          <Select aria-label="Sort stores" value={sort} options={[{ value: 'rating', label: 'Top rated' }, { value: 'newest', label: 'Newest' }, { value: 'name', label: 'Name' }]} onChange={(e) => set({ sort: e.target.value })} />
        </div>
      </div>

      <div className="mt-8">
        {error && (
          <Alert
            tone="danger"
            title="Could not load stores"
            className="mb-5"
            action={<Button size="sm" variant="secondary" onClick={reload}>Retry</Button>}
          >
            {error.message}
          </Alert>
        )}
        {data && data.data.length === 0 ? (
          <EmptyState icon={Store} title="No stores found" message="Try a different search or city." />
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {loading && !data ? Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-64" />) : data?.data.map((s) => <li key={s.id}><StoreCard store={s} /></li>)}
          </ul>
        )}
        {data && <div className="mt-10"><Pagination page={data.meta.current_page} lastPage={data.meta.last_page} onChange={(p) => set({ page: String(p) })} /></div>}
      </div>
    </div>
  )
}
