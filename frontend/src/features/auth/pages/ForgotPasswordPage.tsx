import { zodResolver } from '@hookform/resolvers/zod'
import { MailCheck } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { Alert, Button, Input } from '@/components/ui'
import { applyServerErrors } from '@/utils/forms'
import { authService } from '../authService'
import { type ForgotPasswordValues, forgotPasswordSchema } from '../schemas'

export default function ForgotPasswordPage() {
  const [sentMessage, setSentMessage] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  })

  const onSubmit = handleSubmit(async ({ email }) => {
    setFormError(null)
    try {
      setSentMessage(await authService.forgotPassword(email))
    } catch (error) {
      setFormError(applyServerErrors(error, setError, ['email']))
    }
  })

  if (sentMessage) {
    return (
      <div className="text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-600">
          <MailCheck className="size-6" aria-hidden />
        </span>
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight">Check your inbox</h1>
        <p className="mt-2 text-sm text-ink-muted">{sentMessage}</p>
        <Link to="/login" className="mt-6 inline-block text-sm font-medium text-brand-600 hover:text-brand-700">
          ← Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight">Forgot your password?</h1>
      <p className="mt-1.5 text-sm text-ink-muted">Enter your email and we will send you a reset link.</p>
      <form onSubmit={onSubmit} noValidate className="mt-8 space-y-5">
        {formError && <Alert tone="danger">{formError}</Alert>}
        <Input label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
          Send reset link
        </Button>
        <p className="text-center text-sm">
          <Link to="/login" className="font-medium text-brand-600 hover:text-brand-700">
            Back to sign in
          </Link>
        </p>
      </form>
    </div>
  )
}
