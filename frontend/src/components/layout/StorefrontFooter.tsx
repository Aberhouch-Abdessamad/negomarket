import { Banknote, Handshake, ShieldCheck, Store } from 'lucide-react'
import { Link } from 'react-router'
import { Logo } from './Logo'

const currentYear = new Date().getFullYear()

const columns = [
  { title: 'Shop', links: [['All products', '/products'], ['Categories', '/categories'], ['Open to offers', '/products?negotiable=1'], ['New arrivals', '/products?sort=newest'], ['Top rated', '/products?sort=rating']] },
  { title: 'Sell', links: [['Become a seller', '/sell'], ['Seller center', '/seller'], ['Store directory', '/stores']] },
  { title: 'Your account', links: [['Sign in', '/login'], ['Create account', '/register'], ['My account', '/account/profile'], ['Wishlist', '/wishlist']] },
]

const promises = [
  { icon: Handshake, title: 'Negotiate the price', text: 'Make an offer, chat with the seller, agree together.' },
  { icon: Banknote, title: 'Cash on Delivery', text: 'Pay only when your order arrives at your door.' },
  { icon: ShieldCheck, title: 'Price locked in', text: 'Your accepted offer is the price you pay at checkout.' },
  { icon: Store, title: 'Approved sellers', text: 'Every store is reviewed by our team before selling.' },
]

export function StorefrontFooter() {
  return (
    <footer className="mt-16">
      <div className="border-y border-line bg-surface">
        <ul className="mx-auto grid max-w-[90rem] gap-6 px-4 py-8 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
          {promises.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700"><Icon className="size-5" aria-hidden /></span>
              <span><span className="block text-sm font-bold">{title}</span><span className="block text-sm text-ink-muted">{text}</span></span>
            </li>
          ))}
        </ul>
      </div>
      <div className="bg-brand-950 text-brand-100">
        <div className="mx-auto grid max-w-[90rem] gap-10 px-4 py-12 lg:grid-cols-[1.4fr_repeat(3,1fr)] lg:px-8">
          <div>
            <Logo inverted />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-brand-200">The multi-vendor marketplace where every price can be a conversation. Shop from independent Moroccan stores and pay cash on delivery.</p>
          </div>
          {columns.map((col) => (
            <div key={col.title}>
              <p className="text-sm font-bold text-white">{col.title}</p>
              <ul className="mt-4 space-y-2.5 text-sm">
                {col.links.map(([label, to]) => (
                  <li key={label}><Link to={to} className="text-brand-200 hover:text-white">{label}</Link></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-[90rem] flex-col items-center justify-between gap-3 px-4 py-5 text-xs text-brand-300 sm:flex-row lg:px-8">
            <span>© {currentYear} NegoMarket. All rights reserved.</span>
            <span className="flex items-center gap-4">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-2 py-1 font-semibold text-white"><Banknote className="size-3.5" aria-hidden /> Cash on Delivery</span>
              <Link to="/system/status" className="hover:text-white">System status</Link>
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}
