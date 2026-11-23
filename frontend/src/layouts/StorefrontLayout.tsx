import { useEffect } from 'react'
import { Outlet } from 'react-router'
import { StorefrontFooter } from '@/components/layout/StorefrontFooter'
import { StorefrontHeader } from '@/components/layout/StorefrontHeader'
import { useAuthStore } from '@/store/authStore'
import { useCartStore } from '@/store/cartStore'

export default function StorefrontLayout() {
  const authed = useAuthStore((s) => s.status === 'authenticated')
  const loadCart = useCartStore((s) => s.load)

  useEffect(() => {
    if (authed) void loadCart()
  }, [authed, loadCart])

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2 focus:shadow">Skip to content</a>
      <StorefrontHeader />
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <StorefrontFooter />
    </div>
  )
}
