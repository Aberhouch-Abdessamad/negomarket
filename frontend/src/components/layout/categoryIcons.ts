import { Bike, BookOpen, Camera, Gem, Headphones, Home, Laptop, type LucideIcon, Palette, Shirt, ShoppingBag, Smartphone, Sofa, Sparkles, Tent, Trophy, Utensils, Watch } from 'lucide-react'

/** Presentation-only mapping from category slug to an icon (falls back to a bag). */
const icons: Record<string, LucideIcon> = {
  electronics: Laptop,
  'phones-tablets': Smartphone,
  'laptops-computers': Laptop,
  'audio-headphones': Headphones,
  cameras: Camera,
  fashion: Shirt,
  men: Shirt,
  women: Gem,
  shoes: ShoppingBag,
  'bags-accessories': Watch,
  'home-living': Home,
  furniture: Sofa,
  'kitchen-dining': Utensils,
  decor: Sparkles,
  'rugs-textiles': Palette,
  'beauty-health': Sparkles,
  'sports-outdoors': Trophy,
  cycling: Bike,
  camping: Tent,
  'arts-crafts': Palette,
  handmade: Palette,
  'leather-goods': ShoppingBag,
  books: BookOpen,
}

export function categoryIcon(slug: string): LucideIcon {
  return icons[slug] ?? ShoppingBag
}

/** Soft background tints for category tiles, cycled by index. */
export const tileTints = ['bg-brand-50 text-brand-700', 'bg-accent-50 text-accent-700', 'bg-sky-50 text-sky-700', 'bg-rose-50 text-rose-700', 'bg-violet-50 text-violet-700', 'bg-lime-50 text-lime-700']
