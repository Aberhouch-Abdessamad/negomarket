import { api, ensureCsrfCookie } from './api/client'

export interface HealthReport {
  status: 'ok' | 'degraded'
  app: string
  api_version: string
  environment: string
  server_time: string
  checks: {
    database: { ok: boolean; latency_ms?: number }
  }
}

export const systemService = {
  async health(): Promise<HealthReport> {
    const res = await api.get<HealthReport>('/health')
    return res.data
  },

  /** Verifies the Sanctum CSRF cookie round-trip works (CORS + credentials + cookie domain). */
  async csrf(): Promise<boolean> {
    await ensureCsrfCookie()
    return document.cookie.split('; ').some((c) => c.startsWith('XSRF-TOKEN='))
  },
}
