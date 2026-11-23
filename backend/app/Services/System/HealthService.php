<?php

namespace App\Services\System;

use Illuminate\Support\Facades\DB;
use Throwable;

class HealthService
{
    /**
     * Build a health report. Only non-sensitive information is returned.
     *
     * @return array{status: string, app: string, api_version: string, environment: string, server_time: string, checks: array<string, array{ok: bool, latency_ms?: float}>}
     */
    public function report(): array
    {
        $database = $this->checkDatabase();

        return [
            'status' => $database['ok'] ? 'ok' : 'degraded',
            'app' => config('app.name'),
            'api_version' => 'v1',
            'environment' => app()->environment(),
            'server_time' => now()->toIso8601String(),
            'checks' => [
                'database' => $database,
            ],
        ];
    }

    /** @return array{ok: bool, latency_ms?: float} */
    private function checkDatabase(): array
    {
        $start = microtime(true);

        try {
            DB::connection()->select('select 1');

            return ['ok' => true, 'latency_ms' => round((microtime(true) - $start) * 1000, 2)];
        } catch (Throwable $e) {
            report($e);

            return ['ok' => false];
        }
    }
}
