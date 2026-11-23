import { useEffect } from 'react'
import { RouterProvider, createBrowserRouter } from 'react-router'
import { Toaster } from '@/components/ui'
import { useAuthStore } from '@/store/authStore'
import { useWishlistStore } from '@/store/wishlistStore'
import { routes } from './routes'

const router = createBrowserRouter(routes)

export default function App() {
  const bootstrap = useAuthStore((s) => s.bootstrap)
  const status = useAuthStore((s) => s.status)

  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  // Wishlist hearts follow the session.
  useEffect(() => {
    if (status === 'authenticated') void useWishlistStore.getState().load()
    if (status === 'guest') useWishlistStore.getState().reset()
  }, [status])

  return (
    <>
      <RouterProvider router={router} />
      <Toaster />
    </>
  )
}
