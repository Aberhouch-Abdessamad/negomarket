import { z } from 'zod'

/** Mirrors backend rules (Password::defaults(): min 8, letters + numbers). The API remains the source of truth. */
export const passwordRule = z
  .string()
  .min(8, 'Use at least 8 characters.')
  .max(128, 'Use at most 128 characters.')
  .regex(/[A-Za-z]/, 'Include at least one letter.')
  .regex(/[0-9]/, 'Include at least one number.')

const email = z.string().trim().min(1, 'Email is required.').email('Enter a valid email address.')
const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9 ]{8,20}$/, 'Enter a valid phone number.')

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required.'),
  remember: z.boolean().optional(),
})
export type LoginValues = z.infer<typeof loginSchema>

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, 'Enter your full name.').max(120),
    email,
    phone: phone.optional().or(z.literal('')),
    password: passwordRule,
    password_confirmation: z.string(),
    accept_terms: z.boolean().refine((v) => v, 'You must accept the terms to continue.'),
  })
  .refine((d) => d.password === d.password_confirmation, { path: ['password_confirmation'], message: 'Passwords do not match.' })
export type RegisterValues = z.infer<typeof registerSchema>

export const forgotPasswordSchema = z.object({ email })
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>

export const resetPasswordSchema = z
  .object({ password: passwordRule, password_confirmation: z.string() })
  .refine((d) => d.password === d.password_confirmation, { path: ['password_confirmation'], message: 'Passwords do not match.' })
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>

export const profileSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name.').max(120),
  email,
  phone: phone.optional().or(z.literal('')),
})
export type ProfileValues = z.infer<typeof profileSchema>

export const changePasswordSchema = z
  .object({ current_password: z.string().min(1, 'Enter your current password.'), password: passwordRule, password_confirmation: z.string() })
  .refine((d) => d.password === d.password_confirmation, { path: ['password_confirmation'], message: 'Passwords do not match.' })
  .refine((d) => d.password !== d.current_password, { path: ['password'], message: 'Choose a password different from the current one.' })
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>

export const addressSchema = z.object({
  label: z.string().trim().max(64).optional().or(z.literal('')),
  full_name: z.string().trim().min(2, 'Enter the recipient name.').max(120),
  phone,
  address_line1: z.string().trim().min(3, 'Enter the street address.').max(255),
  address_line2: z.string().trim().max(255).optional().or(z.literal('')),
  city: z.string().trim().min(2, 'Enter the city.').max(120),
  region: z.string().trim().max(120).optional().or(z.literal('')),
  postal_code: z.string().trim().max(20).optional().or(z.literal('')),
  is_default: z.boolean().optional(),
})
export type AddressValues = z.infer<typeof addressSchema>
