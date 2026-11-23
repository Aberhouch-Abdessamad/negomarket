<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Responses\ApiResponse;
use App\Services\System\HealthService;
use Illuminate\Http\JsonResponse;

class HealthController extends Controller
{
    public function __construct(private readonly HealthService $health) {}

    /**
     * GET /api/v1/health
     *
     * Public liveness/readiness probe used by the frontend to verify the
     * API connection. Never exposes secrets or configuration values.
     */
    public function __invoke(): JsonResponse
    {
        $report = $this->health->report();

        return ApiResponse::success(
            $report,
            $report['status'] === 'ok' ? 'NegoMarket API is running.' : 'NegoMarket API is degraded.',
            $report['status'] === 'ok' ? 200 : 503,
        );
    }
}
