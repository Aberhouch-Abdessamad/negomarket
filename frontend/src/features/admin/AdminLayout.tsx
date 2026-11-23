import { BarChart3, ClipboardCheck, Handshake, LayoutDashboard, PackageCheck, ScrollText, Settings2, ShieldAlert, ShoppingBag, Star, Store, Users } from 'lucide-react'
import { AppShell, type ShellNavGroup } from '@/layouts/AppShell'

const groups: ShellNavGroup[] = [
  { label: 'Overview', items: [{ to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard }] },
  {
    label: 'Marketplace',
    items: [
      { to: '/admin/orders', label: 'Orders', icon: ShoppingBag },
      { to: '/admin/negotiations', label: 'Negotiations', icon: Handshake },
      { to: '/admin/disputes', label: 'Disputes', icon: ShieldAlert },
      { to: '/admin/reviews', label: 'Reviews', icon: Star },
    ],
  },
  {
    label: 'Accounts & catalog',
    items: [
      { to: '/admin/users', label: 'Users', icon: Users },
      { to: '/admin/stores', label: 'Stores', icon: Store },
      { to: '/admin/seller-applications', label: 'Seller applications', icon: ClipboardCheck },
      { to: '/admin/moderation', label: 'Product moderation', icon: PackageCheck },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/admin/reports', label: 'Sales report', icon: BarChart3 },
      { to: '/admin/activity-logs', label: 'Activity log', icon: ScrollText },
      { to: '/admin/settings', label: 'Settings', icon: Settings2 },
    ],
  },
]

/** Admin shell: overview, marketplace queues, accounts, catalog and system tools. */
export default function AdminLayout() {
  return <AppShell area="Administration" home="/admin" groups={groups} />
}
