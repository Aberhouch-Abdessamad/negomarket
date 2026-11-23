import { zodResolver } from '@hookform/resolvers/zod'
import { FlaskConical } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { safeRedirect } from '@/app/guards/rules'
import { Alert, Badge, Button, Checkbox, Input, PasswordInput } from '@/components/ui'
import { useAuthStore } from '@/store/authStore'
import { toast } from '@/store/toastStore'
import { applyServerErrors } from '@/utils/forms'
import { type LoginValues, loginSchema } from '../schemas'

const demoAccounts = [
  { role: 'Admin', email: 'admin@negomarket.test', destination: '/admin', detail: 'Dashboard, moderation, settings' },
  { role: 'Seller', email: 'seller@negomarket.test', destination: '/seller', detail: 'Atlas Electronics seller center' },
  { role: 'Customer', email: 'customer@negomarket.test', destination: '/orders', detail: 'Cart, offers, orders, disputes' },
] as const

export default function LoginPage() {
  const login = useAuthStore((s) => s.login)
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [formError, setFormError] = useState<string | null>(null)
  const [filledRole, setFilledRole] = useState<string | null>(null)

  const { register, handleSubmit, setValue, clearErrors, setError, formState: { errors, isSubmitting } } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', remember: false },
  })

  function fillDemoAccount(account: (typeof demoAccounts)[number]) {
    setValue('email', account.email, { shouldDirty: true })
    setValue('password', 'password', { shouldDirty: true })
    clearErrors()
    setFormError(null)
    setFilledRole(account.role)
  }

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      const user = await login(values)
      toast.success(`Welcome back, ${user.name.split(' ')[0]}!`)
      navigate(safeRedirect(params.get('redirect')), { replace: true })
    } catch (error) {
      setFormError(applyServerErrors(error, setError, ['email', 'password']))
    }
  })

  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight">Sign in</h1>
      <p className="mt-1.5 text-sm text-ink-muted">
        New to NegoMarket?{' '}
        <Link to={`/register${params.toString() ? `?${params}` : ''}`} className="font-medium text-brand-600 hover:text-brand-700">
          Create an account
        </Link>
      </p>

      <form onSubmit={onSubmit} noValidate className="mt-8 space-y-5">
        {formError && <Alert tone="danger">{formError}</Alert>}
        <Input label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
        <PasswordInput label="Password" autoComplete="current-password" error={errors.password?.message} {...register('password')} />
        <div className="flex items-center justify-between">
          <Checkbox label="Remember me" {...register('remember')} />
          <Link to="/forgot-password" className="text-sm font-medium text-brand-600 hover:text-brand-700">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
          Sign in
        </Button>
      </form>

      {import.meta.env.DEV && (
        <section aria-labelledby="demo-accounts" className="mt-8 rounded-[var(--radius-card)] border border-dashed border-line bg-canvas/70 p-4">
          <div className="flex items-center gap-2">
            <FlaskConical className="size-4 text-brand-600" aria-hidden />
            <h2 id="demo-accounts" className="text-sm font-bold">Development accounts</h2>
            <Badge tone="warning" className="ml-auto">local only</Badge>
          </div>
          <p className="mt-1.5 text-xs text-ink-muted">
            Seeded by <code className="rounded bg-surface px-1 py-0.5 font-mono text-[11px]">db:seed</code>. Password for all:{' '}
            <code className="rounded bg-surface px-1 py-0.5 font-mono text-[11px]">password</code>. Pick one to fill the form.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {demoAccounts.map((account) => (
              <button
                key={account.email}
                type="button"
                onClick={() => fillDemoAccount(account)}
                aria-label={`Use ${account.role} account`}
                className={`rounded-lg border bg-surface p-3 text-left transition-colors hover:border-brand-300 hover:bg-brand-50/50 ${
                  filledRole === account.role ? 'border-brand-400 ring-1 ring-brand-200' : 'border-line'
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{account.role}</span>
                  <span className="font-mono text-[11px] text-brand-600">{account.destination}</span>
                </span>
                <span className="mt-0.5 block truncate text-xs text-ink-muted">{account.email}</span>
                <span className="mt-1 block text-[11px] leading-snug text-ink-muted">{account.detail}</span>
              </button>
            ))}
          </div>
          <p role="status" className="mt-2 min-h-4 text-xs font-medium text-success-600">
            {filledRole ? `${filledRole} account filled in — press Sign in.` : ''}
          </p>
        </section>
      )}
    </div>
  )
}
