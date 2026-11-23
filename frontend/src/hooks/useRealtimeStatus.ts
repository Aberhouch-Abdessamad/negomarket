import { useMemo, useSyncExternalStore } from 'react'
import { getEcho, isRealtimeConfigured } from '@/services/realtime/echo'

export type RealtimeState = 'not_configured' | 'initialized' | 'connecting' | 'connected' | 'unavailable' | 'failed' | 'disconnected'

interface PusherConnection {
  state: string
  bind: (event: string, cb: () => void) => void
  unbind: (event: string, cb: () => void) => void
}

function resolveConnection(enabled: boolean): PusherConnection | 'not_configured' | 'failed' {
  if (!enabled || !isRealtimeConfigured()) return 'not_configured'
  try {
    return (getEcho().connector as unknown as { pusher: { connection: PusherConnection } }).pusher.connection
  } catch {
    return 'failed'
  }
}

/** Tracks the Reverb WebSocket connection state (no channel subscription needed). */
export function useRealtimeStatus(enabled = true): RealtimeState {
  const connection = useMemo(() => resolveConnection(enabled), [enabled])

  return useSyncExternalStore(
    (notify) => {
      if (typeof connection === 'string') return () => {}
      connection.bind('state_change', notify)
      return () => connection.unbind('state_change', notify)
    },
    () => (typeof connection === 'string' ? connection : (connection.state as RealtimeState)),
  )
}
