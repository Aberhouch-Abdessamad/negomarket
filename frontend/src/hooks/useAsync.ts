import { type DependencyList, useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '@/services/api/types'

export interface AsyncState<T> {
  data: T | undefined
  error: ApiError | null
  loading: boolean
  reload: () => void
}

/**
 * Runs an async loader whenever deps change. Ignores out-of-order responses
 * (e.g. fast filter changes) and keeps the previous data while reloading.
 */
export function useAsync<T>(loader: () => Promise<T>, deps: DependencyList): AsyncState<T> {
  const [data, setData] = useState<T>()
  const [error, setError] = useState<ApiError | null>(null)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  const requestId = useRef(0)

  // oxlint-disable-next-line react-hooks/exhaustive-deps -- deps are supplied by the caller
  const run = useCallback(loader, deps)

  useEffect(() => {
    const id = ++requestId.current
    let active = true
    Promise.resolve()
      .then(() => {
        if (active) setLoading(true)
        return run()
      })
      .then((result) => {
        if (active && id === requestId.current) {
          setData(result)
          setError(null)
        }
      })
      .catch((e: unknown) => {
        if (active && id === requestId.current) setError(e instanceof ApiError ? e : new ApiError(String(e), 0))
      })
      .finally(() => {
        if (active && id === requestId.current) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [run, tick])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { data, error, loading, reload }
}
