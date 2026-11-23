import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Alert, Button, Card, CardBody, PasswordInput } from '@/components/ui'
import { type ChangePasswordValues, changePasswordSchema } from '@/features/auth/schemas'
import { toast } from '@/store/toastStore'
import { applyServerErrors } from '@/utils/forms'
import { accountService } from '../accountService'

export default function SecurityPage() {
  const [formError, setFormError] = useState<string | null>(null)
  const { register, handleSubmit, setError, reset, formState: { errors, isSubmitting } } = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { current_password: '', password: '', password_confirmation: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      toast.success(await accountService.updatePassword(values))
      reset()
    } catch (error) {
      setFormError(applyServerErrors(error, setError, ['current_password', 'password', 'password_confirmation']))
    }
  })

  return (
    <Card>
      <CardBody>
        <h2 className="font-semibold">Change password</h2>
        <p className="mt-1 text-sm text-ink-muted">Changing your password signs you out on all other devices.</p>
        <form onSubmit={onSubmit} noValidate className="mt-6 max-w-md space-y-5">
          {formError && <Alert tone="danger">{formError}</Alert>}
          <PasswordInput label="Current password" autoComplete="current-password" error={errors.current_password?.message} {...register('current_password')} />
          <PasswordInput label="New password" autoComplete="new-password" hint="At least 8 characters with letters and numbers." error={errors.password?.message} {...register('password')} />
          <PasswordInput label="Confirm new password" autoComplete="new-password" error={errors.password_confirmation?.message} {...register('password_confirmation')} />
          <Button type="submit" loading={isSubmitting}>
            Update password
          </Button>
        </form>
      </CardBody>
    </Card>
  )
}
