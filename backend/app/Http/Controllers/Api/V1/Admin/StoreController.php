<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\StoreStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UpdateStoreStatusRequest;
use App\Http\Resources\Admin\StoreAdminResource;
use App\Http\Responses\ApiResponse;
use App\Models\Store;
use App\Services\Admin\StoreAdminService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Store directory and activation controls. */
class StoreController extends Controller
{
    public function __construct(private readonly StoreAdminService $stores) {}

    /** GET /admin/stores */
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'status' => ['nullable', Rule::enum(StoreStatus::class)],
            'q' => ['nullable', 'string', 'max:100'],
            'per_page' => ['nullable', 'integer', 'between:1,50'],
        ]);

        return ApiResponse::success(
            StoreAdminResource::collection($this->stores->index($filters)),
        );
    }

    /** GET /admin/stores/{store} (resolved by id, not slug) */
    public function show(int $store): JsonResponse
    {
        return ApiResponse::success(
            new StoreAdminResource($this->stores->show(Store::query()->findOrFail($store))),
        );
    }

    /** PATCH /admin/stores/{store}/status */
    public function updateStatus(UpdateStoreStatusRequest $request, int $store): JsonResponse
    {
        $store = $this->stores->updateStatus(
            $request->user(),
            Store::query()->findOrFail($store),
            StoreStatus::from($request->validated('status')),
        );

        return ApiResponse::success(new StoreAdminResource($store), 'Store status updated.');
    }
}
