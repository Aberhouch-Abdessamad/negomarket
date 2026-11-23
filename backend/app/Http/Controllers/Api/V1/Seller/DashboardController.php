<?php

namespace App\Http\Controllers\Api\V1\Seller;

use App\Http\Controllers\Controller;
use App\Http\Responses\ApiResponse;
use App\Services\Store\SellerAnalyticsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class DashboardController extends Controller
{
    public function __construct(private readonly SellerAnalyticsService $analytics) {}

    /** GET /seller/dashboard */
    public function dashboard(Request $request): JsonResponse
    {
        return ApiResponse::success($this->analytics->dashboard($request->user()->store));
    }

    /** GET /seller/analytics?period=7|30|90 */
    public function analytics(Request $request): JsonResponse
    {
        $period = (int) ($request->validate(['period' => ['nullable', Rule::in(['7', '30', '90'])]])['period'] ?? 30);

        return ApiResponse::success($this->analytics->analytics($request->user()->store, $period));
    }
}
