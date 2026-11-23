import { zodResolver } from '@hookform/resolvers/zod'
import { Camera, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Alert, Avatar, Badge, Button, Card, CardBody, Input } from '@/components/ui'
import { type ProfileValues, profileSchema } from '@/features/auth/schemas'
import { ApiError } from '@/services/api/types'
import { useAuthStore } from '@/store/authStore'
import { toast } from '@/store/toastStore'
import { applyServerErrors } from '@/utils/forms'
import { accountService } from '../accountService'

const MAX_AVATAR_BYTES = 2 * 1024 * 1024

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user)!
  const setUser = useAuthStore((s) => s.setUser)
  const fileRef = useRef<HTMLInputElement>(null)
  const [avatarBusy, setAvatarBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const { register, handleSubmit, setError, reset, formState: { errors, isSubmitting, isDirty } } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user.name, email: user.email, phone: user.phone ?? '' },
  })

  const onSubmit = handleSubmit(async ({ phone, ...values }) => {
    setFormError(null)
    try {
      const { user: updated, message } = await accountService.updateProfile({ ...values, phone: phone || null })
      setUser(updated)
      reset({ name: updated.name, email: updated.email, phone: updated.phone ?? '' })
      toast.success(message)
    } catch (error) {
      setFormError(applyServerErrors(error, setError, ['name', 'email', 'phone']))
    }
  })

  async function onAvatarSelected(file: File | undefined) {
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return toast.error('Choose a JPG, PNG or WebP image.')
    if (file.size > MAX_AVATAR_BYTES) return toast.error('The image must be 2 MB or smaller.')
    setAvatarBusy(true)
    try {
      setUser(await accountService.uploadAvatar(file))
      toast.success('Profile photo updated.')
    } catch (error) {
      toast.error(error instanceof ApiError ? (Object.values(error.errors)[0]?.[0] ?? error.message) : 'Upload failed.')
    } finally {
      setAvatarBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function removeAvatar() {
    setAvatarBusy(true)
    try {
      setUser(await accountService.removeAvatar())
      toast.success('Profile photo removed.')
    } finally {
      setAvatarBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardBody className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <Avatar name={user.name} src={user.avatar_url} size="xl" />
          <div className="flex-1">
            <p className="text-lg font-semibold">{user.name}</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {user.roles.map((r) => (
                <Badge key={r} tone={r === 'admin' ? 'danger' : r === 'seller' ? 'brand' : 'neutral'} className="capitalize">
                  {r}
                </Badge>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => void onAvatarSelected(e.target.files?.[0])} aria-label="Upload profile photo" />
            <Button variant="secondary" size="sm" leftIcon={<Camera className="size-4" />} loading={avatarBusy} onClick={() => fileRef.current?.click()}>
              Change photo
            </Button>
            {user.avatar_url && (
              <Button variant="ghost" size="sm" aria-label="Remove photo" onClick={() => void removeAvatar()} disabled={avatarBusy}>
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <h2 className="font-semibold">Personal information</h2>
          <p className="mt-1 text-sm text-ink-muted">Changing your email requires verifying the new address.</p>
          <form onSubmit={onSubmit} noValidate className="mt-6 grid gap-5 sm:grid-cols-2">
            {formError && <Alert tone="danger" className="sm:col-span-2">{formError}</Alert>}
            <div className="sm:col-span-2">
              <Input label="Full name" autoComplete="name" error={errors.name?.message} {...register('name')} />
            </div>
            <Input label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
            <Input label="Phone" type="tel" autoComplete="tel" error={errors.phone?.message} {...register('phone')} />
            <div className="flex justify-end sm:col-span-2">
              <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
                Save changes
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}
