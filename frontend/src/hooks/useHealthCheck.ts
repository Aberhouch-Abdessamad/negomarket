import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '@/services/api/types'
import { type HealthReport, systemService } from '@/services/systemService'

export type CheckState<T> =
  | { status: 'loading' }
  | { status: 'success'; data: T; latencyMs: number }
  | { status: 'error'; error: ApiError }

/** Calls GET /api/v1/health and the Sanctum CSRF endpoint, measuring round-trip time. */
export function useHealthCheck() {
  const [health, setHealth] = useState<CheckState<HealthReport>>({ status: 'loading' })
  const [csrf, setCsrf] = useState<CheckState<boolean>>({ status: 'loading' })

  const load = useCallback(async () => {
    const t0 = performance.now()
    try {
      const data = await systemService.health()
      setHealth({ status: 'success', data, latencyMs: Math.round(performance.now() - t0) })
    } catch (e) {
      setHealth({ status: 'error', error: e instanceof ApiError ? e : new ApiError(String(e), 0) })
    }

    const t1 = performance.now()
    try {
      const ok = await systemService.csrf()
      setCsrf({ status: 'success', data: ok, latencyMs: Math.round(performance.now() - t1) })
    } catch (e) {
      setCsrf({ status: 'error', error: e instanceof ApiError ? e : new ApiError(String(e), 0) })
    }
  }, [])

  useEffect(() => {
    // State is only set after awaited network calls, not synchronously.
    // oxlint-disable-next-line react/set-state-in-effect
    void load()
  }, [load])

  const refresh = useCallback(async () => {
    setHealth({ status: 'loading' })
    setCsrf({ status: 'loading' })
    await load()
  }, [load])

  return { health, csrf, refresh }
}
