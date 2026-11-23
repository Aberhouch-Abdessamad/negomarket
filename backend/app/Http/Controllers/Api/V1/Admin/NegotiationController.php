<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\NegotiationStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\Negotiation\NegotiationResource;
use App\Http\Resources\Negotiation\NegotiationSummaryResource;
use App\Http\Responses\ApiResponse;
use App\Models\Negotiation;
use App\Services\Admin\NegotiationMonitorService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Read-only monitoring of every negotiation on the platform. */
class NegotiationController extends Controller
{
    public function __construct(private readonly NegotiationMonitorService $negotiations) {}

    /** GET /admin/negotiations */
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'status' => ['nullable', Rule::enum(NegotiationStatus::class)],
            'store_id' => ['nullable', 'integer', 'min:1'],
            'customer_id' => ['nullable', 'integer', 'min:1'],
            'q' => ['nullable', 'string', 'max:100'],
            'per_page' => ['nullable', 'integer', 'between:1,50'],
        ]);

        return ApiResponse::success(
            NegotiationSummaryResource::collection($this->negotiations->index($filters)),
        );
    }

    /** GET /admin/negotiations/{negotiation} */
    public function show(Negotiation $negotiation): JsonResponse
    {
        return ApiResponse::success(new NegotiationResource($this->negotiations->show($negotiation)));
    }
}
