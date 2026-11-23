import { BarChart3, Boxes, ExternalLink, LayoutDashboard, MessageSquareText, MessagesSquare, Package, PackagePlus, Settings, ShieldAlert, ShoppingCart, Star, Store } from 'lucide-react'
import { Link } from 'react-router'
import { AppShell, type ShellNavGroup } from '@/layouts/AppShell'
import { useAuthStore } from '@/store/authStore'

const groups: ShellNavGroup[] = [
  { items: [{ to: '/seller', label: 'Dashboard', icon: LayoutDashboard, end: true }] },
  {
    label: 'Catalog',
    items: [
      { to: '/seller/products', label: 'Products', icon: Package, end: true },
      { to: '/seller/products/new', label: 'Add Product', icon: PackagePlus },
      { to: '/seller/inventory', label: 'Inventory', icon: Boxes },
    ],
  },
  {
    label: 'Sales',
    items: [
      { to: '/seller/orders', label: 'Orders', icon: ShoppingCart },
      { to: '/seller/negotiations', label: 'Negotiations', icon: MessageSquareText },
      { to: '/seller/messages', label: 'Messages', icon: MessagesSquare },
      { to: '/seller/reviews', label: 'Reviews', icon: Star },
      { to: '/seller/disputes', label: 'Disputes', icon: ShieldAlert },
      { to: '/seller/analytics', label: 'Analytics', icon: BarChart3 },
    ],
  },
  {
    label: 'Store',
    items: [
      { to: '/seller/store', label: 'My Store', icon: Store },
      { to: '/account/profile', label: 'Account settings', icon: Settings },
    ],
  },
]

export default function SellerLayout() {
  const store = useAuthStore((s) => s.user?.store)

  return (
    <AppShell
      area="Seller center"
      home="/seller"
      groups={groups}
      searchPath="/seller/products"
      searchPlaceholder="Search your products"
      context={
        store && (
          <div className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
            <p className="truncate text-sm font-bold text-white">{store.name}</p>
            <Link to={`/stores/${store.slug}`} className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-accent-400 hover:text-accent-200">
              View public store <ExternalLink className="size-3" aria-hidden />
            </Link>
          </div>
        )
      }
    />
  )
}
