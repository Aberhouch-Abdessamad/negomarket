import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import { categoryIcon, tileTints } from '@/components/layout/categoryIcons'
import { cn } from '@/utils/cn'
import { Alert, Skeleton } from '@/components/ui'
import { useAsync } from '@/hooks/useAsync'
import { marketplaceService } from '../marketplaceService'

export default function CategoriesPage() {
  const { data, loading, error } = useAsync(() => marketplaceService.categories(), [])

  return (
    <div className="mx-auto max-w-[90rem] px-4 py-8 lg:px-8">
      <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">All categories</h1>
      <p className="mt-1 text-ink-muted">Browse everything on NegoMarket by department.</p>
      {error && <Alert tone="danger" className="mt-6">{error.message}</Alert>}
      <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {loading && !data
          ? Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-52" />)
          : data?.map((c, i) => {
              const Icon = categoryIcon(c.slug)
              return (
              <li key={c.id} className="rounded-2xl border border-line bg-surface p-6 transition hover:shadow-[var(--shadow-pop)]">
                <Link to={`/categories/${c.slug}`} className="group flex items-center gap-4">
                  <span className={cn('grid size-12 shrink-0 place-items-center rounded-xl', tileTints[i % tileTints.length])}><Icon className="size-6" aria-hidden /></span>
                  <span className="flex-1">
                    <h2 className="text-lg font-bold group-hover:text-brand-700">{c.name}</h2>
                    <span className="text-sm text-ink-subtle">{c.products_count} products</span>
                  </span>
                </Link>
                <ul className="mt-4 space-y-1">
                  {c.children?.map((ch) => (
                    <li key={ch.id}>
                      <Link to={`/categories/${ch.slug}`} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm text-ink-muted hover:bg-canvas hover:text-ink">
                        {ch.name}
                        <span className="flex items-center gap-1 text-xs text-ink-subtle">
                          {ch.products_count} <ChevronRight className="size-3.5" aria-hidden />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
              )
            })}
      </ul>
    </div>
  )
}
