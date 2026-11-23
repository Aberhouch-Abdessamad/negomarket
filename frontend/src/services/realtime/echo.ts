import Echo from 'laravel-echo'
import Pusher from 'pusher-js'
import { http } from '@/services/api/client'
import { env } from '@/utils/env'

/**
 * Laravel Echo client for Reverb. Created lazily so pages that do not need
 * realtime features never open a WebSocket. Private channel authorization
 * goes through our Axios instance so the Sanctum session cookie is used.
 */
let instance: Echo<'reverb'> | null = null

export function isRealtimeConfigured(): boolean {
  return Boolean(env.reverb.key)
}

export function getEcho(): Echo<'reverb'> {
  if (instance) return instance
  if (!env.reverb.key) {
    throw new Error('VITE_REVERB_APP_KEY is not configured.')
  }

  ;(window as unknown as { Pusher: typeof Pusher }).Pusher = Pusher

  instance = new Echo({
    broadcaster: 'reverb',
    key: env.reverb.key,
    wsHost: env.reverb.host,
    wsPort: env.reverb.port,
    wssPort: env.reverb.port,
    forceTLS: env.reverb.scheme === 'https',
    enabledTransports: ['ws', 'wss'],
    authorizer: (channel: { name: string }) => ({
      authorize: (socketId: string, callback: (error: Error | null, data: { auth: string; channel_data?: string } | null) => void) => {
        http
          .post('/api/broadcasting/auth', { socket_id: socketId, channel_name: channel.name })
          .then((response) => callback(null, response.data as { auth: string; channel_data?: string }))
          .catch((error: Error) => callback(error, null))
      },
    }),
  })

  return instance
}

export function disconnectEcho(): void {
  instance?.disconnect()
  instance = null
}
