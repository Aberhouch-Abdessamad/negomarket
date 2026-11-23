import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { ApiError } from '@/services/api/types'

/**
 * Copies Laravel 422 field errors into react-hook-form. Returns a message for
 * a form-level alert when the error is not a field validation error.
 */
export function applyServerErrors<T extends FieldValues>(error: unknown, setError: UseFormSetError<T>, fields: readonly Path<T>[]): string | null {
  if (error instanceof ApiError && error.isValidationError) {
    let unmatched: string | null = null
    for (const [field, messages] of Object.entries(error.errors)) {
      if ((fields as readonly string[]).includes(field)) {
        setError(field as Path<T>, { type: 'server', message: messages[0] })
      } else {
        unmatched ??= messages[0]
      }
    }
    return unmatched
  }
  if (error instanceof ApiError) return error.message
  return 'Something went wrong. Please try again.'
}
