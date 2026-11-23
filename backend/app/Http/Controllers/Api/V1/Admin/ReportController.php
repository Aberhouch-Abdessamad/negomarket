<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Responses\ApiResponse;
use App\Services\Admin\DashboardService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Aggregated sales reporting for the admin panel. */
class ReportController extends Controller
{
    public function __construct(private readonly DashboardService $dashboard) {}

    /** GET /admin/reports/sales?days=30 */
    public function sales(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'days' => ['nullable', 'integer', 'between:1,365'],
        ]);
        $days = (int) ($validated['days'] ?? 30);

        return ApiResponse::success($this->dashboard->salesReport($days));
    }
}
