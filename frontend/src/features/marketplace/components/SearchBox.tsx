import { ArrowRight, Search, Store, Tag } from 'lucide-react'
import { type FormEvent, useEffect, useId, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { cn } from '@/utils/cn'
import { formatPrice } from '@/utils/format'
import { marketplaceService } from '../marketplaceService'
import type { Category, SearchSuggestions } from '../types'

interface Props {
  className?: string
  autoFocus?: boolean
  onNavigate?: () => void
  /** When provided, shows a category scope selector (marketplace header style). */
  categories?: Category[] | null
  size?: 'md' | 'lg'
}

/** Marketplace search with debounced instant suggestions (products, stores, categories). */
export function SearchBox({ className, autoFocus, onNavigate, categories, size = 'md' }: Props) {
  const [q, setQ] = useState('')
  const [scope, setScope] = useState('')
  const [results, setResults] = useState<SearchSuggestions | null>(null)
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const listId = useId()
  const boxRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) return
    let active = true
    const t = setTimeout(() => {
      marketplaceService.search(term).then((r) => active && setResults(r)).catch(() => active && setResults(null))
    }, 250)
    return () => {
      active = false
      clearTimeout(t)
    }
  }, [q])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => !boxRef.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setOpen(false)
    onNavigate?.()
    const params = new URLSearchParams()
    if (q.trim()) params.set('q', q.trim())
    if (scope) params.set('category', scope)
    navigate(`/products${params.toString() ? `?${params}` : ''}`)
  }

  const close = () => {
    setOpen(false)
    setQ('')
    onNavigate?.()
  }

  const showResults = open && q.trim().length >= 2 && results
  const empty = results && results.products.length + results.stores.length + results.categories.length === 0
  const h = size === 'lg' ? 'h-12' : 'h-11'

  return (
    <form ref={boxRef} role="search" onSubmit={submit} className={cn('relative', className)}>
      <div className={cn('flex overflow-hidden rounded-xl border-2 border-brand-600 bg-surface focus-within:ring-4 focus-within:ring-brand-100', h)}>
        {categories && categories.length > 0 && (
          <select
            aria-label="Search in category"
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            className="hidden max-w-40 shrink-0 cursor-pointer border-r border-line bg-canvas px-3 text-sm font-medium text-ink-muted focus:outline-none md:block"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.slug}>{c.name}</option>
            ))}
          </select>
        )}
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
          <input
            type="search"
            value={q}
            autoFocus={autoFocus}
            onChange={(e) => {
              setQ(e.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
            placeholder="Search products, brands, SKUs or stores…"
            aria-label="Search the marketplace"
            aria-controls={listId}
            aria-expanded={Boolean(showResults)}
            className="size-full bg-transparent pl-10 pr-3 text-sm placeholder:text-ink-subtle focus:outline-none"
          />
        </div>
        <button type="submit" aria-label="Search" className="grid w-12 shrink-0 place-items-center bg-brand-600 text-white hover:bg-brand-700 sm:w-14">
          <Search className="size-5" aria-hidden />
        </button>
      </div>
      {showResults && (
        <div id={listId} className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-line bg-surface shadow-[var(--shadow-pop)]">
          {empty && <p className="px-4 py-6 text-center text-sm text-ink-muted">No matches for “{q}”.</p>}
          {results.products.length > 0 && (
            <ul className="p-1.5">
              <li className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">Products</li>
              {results.products.map((p) => (
                <li key={p.id}>
                  <Link to={`/products/${p.slug}`} onClick={close} className="flex items-center gap-3 rounded-lg p-2 hover:bg-canvas">
                    <img src={p.image_url ?? ''} alt="" className="size-11 rounded-lg bg-canvas object-cover" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{p.name}</span>
                      <span className="block truncate text-xs text-ink-subtle">{p.store?.name}{p.allow_negotiation && ' · Open to offers'}</span>
                    </span>
                    <span className="text-sm font-bold">{formatPrice(p.price_from)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {(results.stores.length > 0 || results.categories.length > 0) && (
            <div className="flex flex-wrap gap-1.5 border-t border-line p-3">
              {results.categories.map((c) => (
                <Link key={`c${c.id}`} to={`/categories/${c.slug}`} onClick={close} className="inline-flex items-center gap-1 rounded-full bg-canvas px-2.5 py-1 text-xs font-semibold text-ink-muted hover:text-brand-700">
                  <Tag className="size-3" aria-hidden /> {c.name}
                </Link>
              ))}
              {results.stores.map((s) => (
                <Link key={`s${s.id}`} to={`/stores/${s.slug}`} onClick={close} className="inline-flex items-center gap-1 rounded-full bg-canvas px-2.5 py-1 text-xs font-semibold text-ink-muted hover:text-brand-700">
                  <Store className="size-3" aria-hidden /> {s.name}
                </Link>
              ))}
            </div>
          )}
          {!empty && (
            <button type="submit" className="flex w-full items-center justify-between border-t border-line px-4 py-2.5 text-left text-sm font-semibold text-brand-700 hover:bg-canvas">
              See all results for “{q.trim()}” <ArrowRight className="size-4" aria-hidden />
            </button>
          )}
        </div>
      )}
    </form>
  )
}
