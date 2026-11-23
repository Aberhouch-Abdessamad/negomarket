import { ShieldAlert } from 'lucide-react'
import { Link } from 'react-router'

export default function ForbiddenPage() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-danger-50 text-danger-600">
        <ShieldAlert className="size-6" aria-hidden />
      </span>
      <h1 className="mt-4 text-2xl font-extrabold tracking-tight">Access denied</h1>
      <p className="mt-2 text-ink-muted">Your account does not have permission to view this page.</p>
      <Link to="/" className="mt-6 text-sm font-medium text-brand-600 hover:text-brand-700">
        ← Back to home
      </Link>
    </div>
  )
}
