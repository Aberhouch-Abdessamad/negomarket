import { MessagesSquare, ShieldCheck, Truck } from 'lucide-react'
import { Outlet } from 'react-router'
import { Logo } from '@/components/layout/Logo'

const points = [
  { icon: MessagesSquare, text: 'Negotiate prices directly with sellers in real time.' },
  { icon: ShieldCheck, text: 'Your agreed price is locked in at checkout.' },
  { icon: Truck, text: 'Pay in cash when your order arrives.' },
]

/** Split-screen layout for sign-in / sign-up / password pages. */
export default function AuthLayout() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-brand-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 -top-24 size-96 rounded-full bg-brand-600/40 blur-3xl" aria-hidden />
        <div className="absolute -bottom-32 -left-16 size-96 rounded-full bg-accent-500/20 blur-3xl" aria-hidden />
        <Logo inverted className="relative" />
        <div className="relative max-w-md">
          <h2 className="text-4xl font-extrabold leading-tight tracking-tight">Every price is a <span className="text-accent-400">conversation</span>.</h2>
          <ul className="mt-8 space-y-4">
            {points.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-brand-200">
                <Icon className="mt-0.5 size-5 shrink-0 text-white" aria-hidden />
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-brand-200">Multi-vendor marketplace · Cash on Delivery</p>
      </aside>

      <main className="flex flex-col px-4 py-8 sm:px-8">
        <Logo className="mb-8 lg:hidden" />
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
