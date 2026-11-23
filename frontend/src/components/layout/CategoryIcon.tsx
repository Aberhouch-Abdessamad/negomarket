import { createElement } from 'react'
import { categoryIcon } from './categoryIcons'

/** Renders the presentation icon for a category slug. */
export function CategoryIcon({ slug, className }: { slug: string; className?: string }) {
  return createElement(categoryIcon(slug), { className, 'aria-hidden': true })
}
