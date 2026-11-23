/**
 * Typed access to Vite environment variables. Only VITE_* values are exposed
 * to the browser, so never put secrets here.
 */
export const env = {
  apiUrl: (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? 'http://localhost:8000',
  appName: (import.meta.env.VITE_APP_NAME as string | undefined) ?? 'NegoMarket',
  reverb: {
    key: import.meta.env.VITE_REVERB_APP_KEY as string | undefined,
    host: (import.meta.env.VITE_REVERB_HOST as string | undefined) ?? 'localhost',
    port: Number(import.meta.env.VITE_REVERB_PORT ?? 8080),
    scheme: (import.meta.env.VITE_REVERB_SCHEME as string | undefined) ?? 'http',
  },
} as const
