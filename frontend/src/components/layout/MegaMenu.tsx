import { ChevronRight, LayoutGrid } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import type { Category } from '@/features/marketplace/types'
import { cn } from '@/utils/cn'
import { categoryIcon } from './categoryIcons'

/** "All categories" mega-menu: departments on the left, sub-categories on the right. */
export function MegaMenu({ categories }: { categories: Category[] | null }) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const onDoc = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDoc)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDoc)
    }
  }, [open])

  const current = categories?.[active]

  return (
    <div
      ref={ref}
      className="relative"
      onMouseEnter={() => { clearTimeout(timer.current); setOpen(true) }}
      onMouseLeave={() => { timer.current = setTimeout(() => setOpen(false), 150) }}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
      >
        <LayoutGrid className="size-4" aria-hidden /> All categories
      </button>
      {open && categories && current && (
        <div className="absolute left-0 top-full z-50 mt-1 flex w-[44rem] overflow-hidden rounded-xl border border-line bg-surface shadow-[var(--shadow-pop)]">
          <ul className="w-60 shrink-0 border-r border-line bg-canvas/60 py-2" aria-label="Departments">
            {categories.map((c, i) => {
              const Icon = categoryIcon(c.slug)
              return (
                <li key={c.id}>
                  <Link
                    to={`/categories/${c.slug}`}
                    onMouseEnter={() => setActive(i)}
                    onFocus={() => setActive(i)}
                    onClick={() => setOpen(false)}
                    className={cn('flex items-center gap-3 px-4 py-2.5 text-sm font-medium', i === active ? 'bg-surface text-brand-700' : 'text-ink hover:bg-surface')}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden />
                    <span className="flex-1">{c.name}</span>
                    <ChevronRight className="size-4 text-ink-subtle" aria-hidden />
                  </Link>
                </li>
              )
            })}
          </ul>
          <div className="flex-1 p-6">
            <div className="flex items-baseline justify-between">
              <p className="text-lg font-bold">{current.name}</p>
              <Link to={`/categories/${current.slug}`} onClick={() => setOpen(false)} className="text-sm font-semibold text-brand-700 hover:underline">
                Shop all ({current.products_count ?? 0})
              </Link>
            </div>
            <ul className="mt-4 grid grid-cols-2 gap-2">
              {current.children?.map((ch) => {
                const Icon = categoryIcon(ch.slug)
                return (
                  <li key={ch.id}>
                    <Link to={`/categories/${ch.slug}`} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-lg p-2.5 hover:bg-canvas">
                      <span className="grid size-9 place-items-center rounded-lg bg-brand-50 text-brand-700"><Icon className="size-4" aria-hidden /></span>
                      <span>
                        <span className="block text-sm font-semibold">{ch.name}</span>
                        <span className="block text-xs text-ink-subtle">{ch.products_count ?? 0} products</span>
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
            <Link to={`/products?category=${current.slug}&negotiable=1`} onClick={() => setOpen(false)} className="mt-5 flex items-center justify-between rounded-xl bg-accent-50 px-4 py-3 text-sm font-semibold text-accent-700 ring-1 ring-accent-200 hover:bg-accent-100">
              Make an offer on {current.name.toLowerCase()} <ChevronRight className="size-4" aria-hidden />
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
