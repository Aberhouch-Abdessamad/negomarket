import { Handshake, LogOut, MapPin, Package, ShieldAlert, ShieldCheck, Store, UserRound } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { Avatar, Dropdown, DropdownItem } from '@/components/ui'
import { useAuthStore } from '@/store/authStore'
import { useCartStore } from '@/store/cartStore'
import { toast } from '@/store/toastStore'

/** Header account area: sign-in links for guests, avatar menu for users. */
export function AccountMenu() {
  const { status, user, logout } = useAuthStore()
  const resetCart = useCartStore((s) => s.reset)
  const navigate = useNavigate()

  if (status !== 'authenticated' || !user) {
    return (
      <div className="flex items-center gap-2">
        <span className="hidden size-9 place-items-center rounded-full bg-canvas text-ink-muted sm:grid"><UserRound className="size-5" aria-hidden /></span>
        <span className="flex flex-col leading-tight">
          <Link to="/login" className="text-sm font-bold text-ink hover:text-brand-700">Sign in</Link>
          <Link to="/register" className="hidden text-xs text-ink-muted hover:text-brand-700 sm:block">or create account</Link>
        </span>
      </div>
    )
  }

  return (
    <Dropdown
      label="Account menu"
      trigger={
        <span className="flex items-center gap-2 rounded-lg p-1 pr-2 hover:bg-canvas">
          <Avatar name={user.name} src={user.avatar_url} size="sm" />
          <span className="hidden flex-col text-left leading-tight sm:flex">
            <span className="text-xs text-ink-muted">Hello, {user.name.split(' ')[0]}</span>
            <span className="text-sm font-bold">Account</span>
          </span>
        </span>
      }
    >
      {(close) => (
        <>
          <div className="border-b border-line px-3 pb-2.5 pt-1.5">
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <p className="truncate text-xs text-ink-subtle">{user.email}</p>
          </div>
          <div className="py-1">
            <DropdownItem icon={<UserRound className="size-4" />} onSelect={() => { close(); navigate('/account/profile') }}>
              My account
            </DropdownItem>
            <DropdownItem icon={<Package className="size-4" />} onSelect={() => { close(); navigate('/orders') }}>
              My orders
            </DropdownItem>
            <DropdownItem icon={<MapPin className="size-4" />} onSelect={() => { close(); navigate('/account/addresses') }}>
              Addresses
            </DropdownItem>
            <DropdownItem icon={<Handshake className="size-4" />} onSelect={() => { close(); navigate('/negotiations') }}>
              Negotiations
            </DropdownItem>
            <DropdownItem icon={<ShieldAlert className="size-4" />} onSelect={() => { close(); navigate('/account/disputes') }}>
              Disputes
            </DropdownItem>
            {user.is_seller ? (
              <DropdownItem icon={<Store className="size-4" />} onSelect={() => { close(); navigate('/seller') }}>
                Seller center
              </DropdownItem>
            ) : (
              <DropdownItem icon={<Store className="size-4" />} onSelect={() => { close(); navigate('/sell') }}>
                {user.seller_application?.status === 'pending' ? 'Seller application' : 'Become a seller'}
              </DropdownItem>
            )}
            {user.is_admin && (
              <DropdownItem icon={<ShieldCheck className="size-4" />} onSelect={() => { close(); navigate('/admin') }}>
                Administration
              </DropdownItem>
            )}
          </div>
          <div className="border-t border-line pt-1">
            <DropdownItem
              danger
              icon={<LogOut className="size-4" />}
              onSelect={async () => {
                close()
                await logout()
                resetCart()
                toast.info('You have been signed out.')
                navigate('/')
              }}
            >
              Sign out
            </DropdownItem>
          </div>
        </>
      )}
    </Dropdown>
  )
}
