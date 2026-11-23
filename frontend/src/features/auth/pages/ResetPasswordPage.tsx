import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Alert, Button, Input, PasswordInput } from '@/components/ui'
import { toast } from '@/store/toastStore'
import { applyServerErrors } from '@/utils/forms'
import { authService } from '../authService'
import { type ResetPasswordValues, resetPasswordSchema } from '../schemas'

export default function ResetPasswordPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token') ?? ''
  const email = params.get('email') ?? ''
  const [formError, setFormError] = useState<string | null>(null)

  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', password_confirmation: '' },
  })

  if (!token || !email) {
    return (
      <Alert tone="danger" title="Invalid reset link">
        This password reset link is incomplete.{' '}
        <Link to="/forgot-password" className="font-medium underline">
          Request a new one
        </Link>
        .
      </Alert>
    )
  }

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      toast.success(await authService.resetPassword({ ...values, token, email }))
      navigate('/login', { replace: true })
    } catch (error) {
      setFormError(applyServerErrors(error, setError, ['password', 'password_confirmation']))
    }
  })

  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight">Choose a new password</h1>
      <form onSubmit={onSubmit} noValidate className="mt-8 space-y-5">
        {formError && (
          <Alert tone="danger">
            {formError}{' '}
            <Link to="/forgot-password" className="font-medium underline">
              Request a new link
            </Link>
          </Alert>
        )}
        <Input label="Email" type="email" value={email} readOnly disabled />
        <PasswordInput label="New password" autoComplete="new-password" hint="At least 8 characters with letters and numbers." error={errors.password?.message} {...register('password')} />
        <PasswordInput label="Confirm new password" autoComplete="new-password" error={errors.password_confirmation?.message} {...register('password_confirmation')} />
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
          Reset password
        </Button>
      </form>
    </div>
  )
}
