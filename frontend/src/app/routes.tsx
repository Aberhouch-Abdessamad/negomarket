import type { ComponentType } from 'react'
import { Navigate, type RouteObject } from 'react-router'
import AuthLayout from '@/layouts/AuthLayout'
import StorefrontLayout from '@/layouts/StorefrontLayout'
import NotFoundPage, { RouteErrorPage } from '@/pages/NotFoundPage'
import { RequireAuth, RequireGuest, RequireRole } from './guards'
import { rules } from './guards/rules'

const page = (loader: () => Promise<{ default: ComponentType }>) => async () => ({ Component: (await loader()).default })

/**
 * Route table. Pages are lazy-loaded (one chunk each).
 * Seller (/seller/*) and admin (/admin/*) groups use <RequireRole> from Phase 5/10.
 */
export const routes: RouteObject[] = [
  {
    errorElement: <RouteErrorPage />,
    children: [
      {
        element: <StorefrontLayout />,
        children: [
          { index: true, lazy: page(() => import('@/features/marketplace/pages/HomePage')) },
          { path: 'products', lazy: page(() => import('@/features/marketplace/pages/ProductsPage')) },
          { path: 'products/:slug', lazy: page(() => import('@/features/products/pages/ProductDetailPage')) },
          { path: 'categories', lazy: page(() => import('@/features/marketplace/pages/CategoriesPage')) },
          { path: 'categories/:slug', lazy: page(() => import('@/features/marketplace/pages/ProductsPage')) },
          { path: 'stores', lazy: page(() => import('@/features/stores/pages/StoresPage')) },
          { path: 'stores/:slug', lazy: page(() => import('@/features/stores/pages/StorePage')) },
          { path: 'wishlist', element: <RequireAuth />, children: [{ index: true, lazy: page(() => import('@/features/marketplace/pages/WishlistPage')) }] },
          { path: 'cart', element: <RequireAuth />, children: [{ index: true, lazy: page(() => import('@/features/cart/pages/CartPage')) }] },
          {
            path: 'checkout',
            element: <RequireAuth />,
            children: [
              { index: true, lazy: page(() => import('@/features/cart/pages/CheckoutPage')) },
              { path: 'success', lazy: page(() => import('@/features/cart/pages/OrderConfirmationPage')) },
            ],
          },
          {
            path: 'orders',
            element: <RequireAuth />,
            children: [
              { index: true, lazy: page(() => import('@/features/orders/pages/CustomerOrdersPage')) },
              { path: ':id', lazy: page(() => import('@/features/orders/pages/CustomerOrderDetailPage')) },
            ],
          },
          {
            path: 'negotiations',
            element: <RequireAuth />,
            children: [
              { index: true, lazy: page(() => import('@/features/negotiations/pages/NegotiationsPage')) },
              { path: ':id', lazy: page(() => import('@/features/negotiations/pages/NegotiationThreadPage')) },
            ],
          },
          { path: 'system/status', lazy: page(() => import('@/pages/SystemStatusPage')) },
          {
            path: 'account',
            element: <RequireAuth />,
            children: [
              {
                lazy: page(() => import('@/features/account/AccountLayout')),
                children: [
                  { index: true, element: <Navigate to="profile" replace /> },
                  { path: 'profile', lazy: page(() => import('@/features/account/pages/ProfilePage')) },
                  { path: 'security', lazy: page(() => import('@/features/account/pages/SecurityPage')) },
                  { path: 'addresses', lazy: page(() => import('@/features/account/pages/AddressesPage')) },
                  { path: 'disputes', lazy: page(() => import('@/features/orders/pages/DisputesPage')) },
                  { path: 'disputes/:id', lazy: page(() => import('@/features/orders/pages/DisputeDetailPage')) },
                ],
              },
            ],
          },
          { path: 'sell', element: <RequireAuth />, children: [{ index: true, lazy: page(() => import('@/features/seller/pages/BecomeSellerPage')) }] },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
      {
        path: 'seller',
        element: <RequireRole rule={rules.approvedSeller} />,
        children: [
          {
            lazy: page(() => import('@/features/seller/SellerLayout')),
            children: [
              { index: true, lazy: page(() => import('@/features/seller/pages/SellerDashboardPage')) },
              { path: 'store', lazy: page(() => import('@/features/seller/pages/StoreSettingsPage')) },
              { path: 'products', lazy: page(() => import('@/features/seller/pages/SellerProductsPage')) },
              { path: 'products/new', lazy: page(() => import('@/features/seller/pages/ProductFormPage')) },
              { path: 'products/:id', lazy: page(() => import('@/features/seller/pages/ProductFormPage')) },
              { path: 'inventory', lazy: page(() => import('@/features/seller/pages/InventoryPage')) },
              { path: 'reviews', lazy: page(() => import('@/features/seller/pages/SellerReviewsPage')) },
              { path: 'orders', lazy: page(() => import('@/features/orders/pages/SellerOrdersPage')) },
              { path: 'orders/:id', lazy: page(() => import('@/features/orders/pages/SellerOrderDetailPage')) },
              { path: 'disputes', lazy: page(() => import('@/features/orders/pages/DisputesPage')) },
              { path: 'disputes/:id', lazy: page(() => import('@/features/orders/pages/DisputeDetailPage')) },
              { path: 'negotiations', lazy: page(() => import('@/features/negotiations/pages/NegotiationsPage')) },
              { path: 'negotiations/:id', lazy: page(() => import('@/features/negotiations/pages/NegotiationThreadPage')) },
              { path: 'messages', lazy: page(() => import('@/features/seller/pages/SellerMessagesPage')) },
              { path: 'analytics', lazy: page(() => import('@/features/seller/pages/AnalyticsPage')) },
            ],
          },
        ],
      },
      {
        path: 'admin',
        element: <RequireRole rule={rules.admin} />,
        children: [
          {
            lazy: page(() => import('@/features/admin/AdminLayout')),
            children: [
              { index: true, element: <Navigate to="dashboard" replace /> },
              { path: 'dashboard', lazy: page(() => import('@/features/admin/pages/AdminDashboardPage')) },
              { path: 'users', lazy: page(() => import('@/features/admin/pages/AdminUsersPage')) },
              { path: 'stores', lazy: page(() => import('@/features/admin/pages/AdminStoresPage')) },
              { path: 'orders', lazy: page(() => import('@/features/admin/pages/AdminOrdersPage')) },
              { path: 'orders/:id', lazy: page(() => import('@/features/admin/pages/AdminOrderDetailPage')) },
              { path: 'negotiations', lazy: page(() => import('@/features/admin/pages/AdminNegotiationsPage')) },
              { path: 'negotiations/:id', lazy: page(() => import('@/features/admin/pages/AdminNegotiationDetailPage')) },
              { path: 'reviews', lazy: page(() => import('@/features/admin/pages/AdminReviewsPage')) },
              { path: 'reports', lazy: page(() => import('@/features/admin/pages/AdminReportsPage')) },
              { path: 'activity-logs', lazy: page(() => import('@/features/admin/pages/AdminActivityLogsPage')) },
              { path: 'settings', lazy: page(() => import('@/features/admin/pages/AdminSettingsPage')) },
              { path: 'seller-applications', lazy: page(() => import('@/features/admin/pages/SellerApplicationsPage')) },
              { path: 'moderation', lazy: page(() => import('@/features/admin/pages/ProductModerationPage')) },
              { path: 'disputes', lazy: page(() => import('@/features/orders/pages/DisputesPage')) },
              { path: 'disputes/:id', lazy: page(() => import('@/features/orders/pages/DisputeDetailPage')) },
            ],
          },
        ],
      },
      {
        element: <AuthLayout />,
        children: [
          {
            element: <RequireGuest />,
            children: [
              { path: 'login', lazy: page(() => import('@/features/auth/pages/LoginPage')) },
              { path: 'register', lazy: page(() => import('@/features/auth/pages/RegisterPage')) },
            ],
          },
          { path: 'forgot-password', lazy: page(() => import('@/features/auth/pages/ForgotPasswordPage')) },
          { path: 'reset-password', lazy: page(() => import('@/features/auth/pages/ResetPasswordPage')) },
        ],
      },
    ],
  },
]
