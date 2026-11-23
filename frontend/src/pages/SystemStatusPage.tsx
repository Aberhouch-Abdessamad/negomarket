import { CheckCircle2, Cookie, Database, RefreshCw, Server, Wifi, XCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import { Badge, Button, Card, CardBody, Skeleton } from '@/components/ui'
import { type CheckState, useHealthCheck } from '@/hooks/useHealthCheck'
import { type RealtimeState, useRealtimeStatus } from '@/hooks/useRealtimeStatus'
import { env } from '@/utils/env'

function StatusRow({ icon, title, description, children }: { icon: ReactNode; title: string; description: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">{icon}</span>
        <div>
          <p className="font-medium">{title}</p>
          <p className="text-sm text-ink-subtle">{description}</p>
        </div>
      </div>
      <div className="sm:text-right">{children}</div>
    </div>
  )
}

function CheckResult<T>({ state, okLabel }: { state: CheckState<T>; okLabel: (data: T, ms: number) => string }) {
  if (state.status === 'loading') return <Skeleton className="h-6 w-32" />
  if (state.status === 'error') {
    return (
      <Badge tone="danger" role="status">
        <XCircle className="size-3.5" aria-hidden /> {state.error.isNetworkError ? 'Unreachable' : `Error ${state.error.status}`}
      </Badge>
    )
  }
  return (
    <Badge tone="success" role="status">
      <CheckCircle2 className="size-3.5" aria-hidden /> {okLabel(state.data, state.latencyMs)}
    </Badge>
  )
}

const realtimeTone: Record<RealtimeState, 'success' | 'warning' | 'danger' | 'neutral'> = {
  connected: 'success',
  initialized: 'neutral',
  connecting: 'warning',
  not_configured: 'neutral',
  unavailable: 'danger',
  failed: 'danger',
  disconnected: 'warning',
}

export default function SystemStatusPage() {
  const { health, csrf, refresh } = useHealthCheck()
  const realtime = useRealtimeStatus()

  const overall =
    health.status === 'loading' ? 'checking' : health.status === 'success' && health.data.status === 'ok' ? 'operational' : 'issues'

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:py-16">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-brand-600">Developer tools</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">System status</h1>
          <p className="mt-2 text-ink-muted">Live checks between this React app and the Laravel API at {env.apiUrl}.</p>
        </div>
        <Button variant="secondary" onClick={() => void refresh()} leftIcon={<RefreshCw className="size-4" aria-hidden />}>
          Re-run checks
        </Button>
      </div>

      <Card>
        <CardBody className="divide-y divide-line py-1">
          <StatusRow icon={<Server className="size-5" />} title="API connection" description="GET /api/v1/health">
            <CheckResult state={health} okLabel={(d, ms) => `${d.app} ${d.api_version} · ${ms} ms`} />
          </StatusRow>

          <StatusRow icon={<Database className="size-5" />} title="Database (MySQL)" description="Checked by the API with SELECT 1">
            {health.status === 'success' ? (
              <Badge tone={health.data.checks.database.ok ? 'success' : 'danger'} role="status">
                {health.data.checks.database.ok ? (
                  <>
                    <CheckCircle2 className="size-3.5" aria-hidden /> Connected · {health.data.checks.database.latency_ms} ms
                  </>
                ) : (
                  <>
                    <XCircle className="size-3.5" aria-hidden /> Unavailable
                  </>
                )}
              </Badge>
            ) : (
              <CheckResult state={health} okLabel={() => ''} />
            )}
          </StatusRow>

          <StatusRow icon={<Cookie className="size-5" />} title="Sanctum session (CSRF cookie)" description="GET /sanctum/csrf-cookie with credentials">
            <CheckResult state={csrf} okLabel={(ok, ms) => (ok ? `Cookie set · ${ms} ms` : 'Request ok, cookie not readable')} />
          </StatusRow>

          <StatusRow icon={<Wifi className="size-5" />} title="Realtime (Laravel Reverb)" description={`ws://${env.reverb.host}:${env.reverb.port}`}>
            <Badge tone={realtimeTone[realtime]} role="status">
              {realtime.replace('_', ' ')}
            </Badge>
          </StatusRow>
        </CardBody>
      </Card>

      <p className="mt-6 text-sm text-ink-subtle">
        Overall:{' '}
        <span className="font-medium text-ink" data-testid="overall-status">
          {overall}
        </span>
        {health.status === 'error' && <span className="block text-danger-600">{health.error.message}</span>}
      </p>
    </div>
  )
}
