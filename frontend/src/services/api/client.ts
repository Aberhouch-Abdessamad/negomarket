import axios, { AxiosError, type AxiosInstance } from 'axios'
import { env } from '@/utils/env'
import { ApiError, type ApiErrorBody, type ApiSuccess } from './types'

/**
 * Shared Axios instance for the NegoMarket API.
 *
 * Auth uses Laravel Sanctum SPA cookies: `withCredentials` sends the session
 * cookie and `withXSRFToken` forwards the XSRF-TOKEN cookie as a header on
 * cross-origin requests (frontend :5173 -> API :8000).
 */
export const http: AxiosInstance = axios.create({
  baseURL: env.apiUrl,
  withCredentials: true,
  withXSRFToken: true,
  timeout: 15_000,
  headers: {
    Accept: 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
})

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error
  if (error instanceof AxiosError) {
    if (!error.response) {
      return new ApiError('Unable to reach the NegoMarket API. Check that the backend is running.', 0)
    }
    const body = error.response.data as Partial<ApiErrorBody> | undefined
    return new ApiError(body?.message ?? error.message, error.response.status, body?.errors ?? {})
  }
  return new ApiError(error instanceof Error ? error.message : 'Unexpected error', 0)
}

type UnauthorizedHandler = () => void
let onUnauthorized: UnauthorizedHandler | null = null

/** Registers a callback for 401 responses (the auth store uses it to drop the session). */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  onUnauthorized = handler
}

http.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (error instanceof AxiosError && error.response && error.config) {
      const config = error.config as typeof error.config & { _csrfRetried?: boolean }

      // 419 = CSRF token mismatch / expired session cookie: refresh once and retry.
      if (error.response.status === 419 && !config._csrfRetried) {
        config._csrfRetried = true
        await ensureCsrfCookie()
        return http.request(config)
      }

      if (error.response.status === 401 && !config.url?.endsWith('/auth/me')) {
        onUnauthorized?.()
      }
    }
    return Promise.reject(toApiError(error))
  },
)

/** Fetch the Sanctum CSRF cookie. Must be called before the first state-changing request. */
export async function ensureCsrfCookie(): Promise<void> {
  await http.get('/sanctum/csrf-cookie')
}

/** Small typed helpers that unwrap the `{ success, data }` envelope. */
export const api = {
  async get<T>(url: string, params?: Record<string, unknown>): Promise<ApiSuccess<T>> {
    const { data } = await http.get<ApiSuccess<T>>(`/api/v1${url}`, { params })
    return data
  },
  async post<T>(url: string, body?: unknown): Promise<ApiSuccess<T>> {
    const { data } = await http.post<ApiSuccess<T>>(`/api/v1${url}`, body)
    return data
  },
  async put<T>(url: string, body?: unknown): Promise<ApiSuccess<T>> {
    const { data } = await http.put<ApiSuccess<T>>(`/api/v1${url}`, body)
    return data
  },
  async patch<T>(url: string, body?: unknown): Promise<ApiSuccess<T>> {
    const { data } = await http.patch<ApiSuccess<T>>(`/api/v1${url}`, body)
    return data
  },
  async upload<T>(url: string, form: FormData): Promise<ApiSuccess<T>> {
    const { data } = await http.post<ApiSuccess<T>>(`/api/v1${url}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data
  },
  async delete<T>(url: string): Promise<ApiSuccess<T>> {
    const { data } = await http.delete<ApiSuccess<T>>(`/api/v1${url}`)
    return data
  },
}
