<?php

namespace App\Http\Controllers\Api\V1\Marketplace;

use App\Http\Controllers\Controller;
use App\Http\Resources\Marketplace\StoreResource;
use App\Http\Responses\ApiResponse;
use App\Services\Marketplace\StoreDirectoryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class StoreController extends Controller
{
    public function __construct(private readonly StoreDirectoryService $stores) {}

    /** GET /stores */
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'city' => ['nullable', 'string', 'max:120'],
            'sort' => ['nullable', Rule::in(['rating', 'newest', 'name'])],
            'per_page' => ['nullable', 'integer', 'between:1,48'],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);

        return ApiResponse::success(StoreResource::collection($this->stores->search($filters)), meta: ['cities' => $this->stores->cities()]);
    }

    /** GET /stores/{slug} – products are loaded via GET /products?store={slug} */
    public function show(string $slug): JsonResponse
    {
        return ApiResponse::success(new StoreResource($this->stores->findBySlug($slug)));
    }
}
