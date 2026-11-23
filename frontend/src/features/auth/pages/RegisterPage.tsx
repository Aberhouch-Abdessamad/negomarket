import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { safeRedirect } from '@/app/guards/rules'
import { Alert, Button, Checkbox, Input, PasswordInput } from '@/components/ui'
import { useAuthStore } from '@/store/authStore'
import { toast } from '@/store/toastStore'
import { applyServerErrors } from '@/utils/forms'
import { type RegisterValues, registerSchema } from '../schemas'

const FIELDS = ['name', 'email', 'phone', 'password', 'password_confirmation', 'accept_terms'] as const

export default function RegisterPage() {
  const registerUser = useAuthStore((s) => s.register)
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [formError, setFormError] = useState<string | null>(null)

  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', phone: '', password: '', password_confirmation: '', accept_terms: false },
  })

  const onSubmit = handleSubmit(async ({ phone, ...values }) => {
    setFormError(null)
    try {
      const { message } = await registerUser({ ...values, phone: phone || undefined })
      toast.success(message || 'Account created.')
      navigate(safeRedirect(params.get('redirect')), { replace: true })
    } catch (error) {
      setFormError(applyServerErrors(error, setError, FIELDS))
    }
  })

  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight">Create your account</h1>
      <p className="mt-1.5 text-sm text-ink-muted">
        Already have an account?{' '}
        <Link to={`/login${params.toString() ? `?${params}` : ''}`} className="font-medium text-brand-600 hover:text-brand-700">
          Sign in
        </Link>
      </p>

      <form onSubmit={onSubmit} noValidate className="mt-8 space-y-4">
        {formError && <Alert tone="danger">{formError}</Alert>}
        <Input label="Full name" autoComplete="name" required error={errors.name?.message} {...register('name')} />
        <Input label="Email" type="email" autoComplete="email" required error={errors.email?.message} {...register('email')} />
        <Input label="Phone" type="tel" autoComplete="tel" placeholder="06 12 34 56 78" hint="Optional – used by sellers to arrange delivery." error={errors.phone?.message} {...register('phone')} />
        <PasswordInput label="Password" autoComplete="new-password" required hint="At least 8 characters with letters and numbers." error={errors.password?.message} {...register('password')} />
        <PasswordInput label="Confirm password" autoComplete="new-password" required error={errors.password_confirmation?.message} {...register('password_confirmation')} />
        <Checkbox label="I agree to the Terms of Service and Privacy Policy." error={errors.accept_terms?.message} {...register('accept_terms')} />
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
          Create account
        </Button>
        <p className="text-center text-xs text-ink-subtle">Want to sell? Create a customer account first, then apply to open a store.</p>
      </form>
    </div>
  )
}
