<?php

namespace App\Http\Controllers\Api\V1\Marketplace;

use App\Http\Controllers\Controller;
use App\Http\Resources\Marketplace\CategoryResource;
use App\Http\Responses\ApiResponse;
use App\Services\Marketplace\CategoryService;
use Illuminate\Http\JsonResponse;

class CategoryController extends Controller
{
    public function __construct(private readonly CategoryService $categories) {}

    /** GET /categories – active tree with visible product counts */
    public function index(): JsonResponse
    {
        return ApiResponse::success($this->categories->tree());
    }

    /** GET /categories/{slug} */
    public function show(string $slug): JsonResponse
    {
        $category = $this->categories->findBySlug($slug);

        return ApiResponse::success([
            ...(new CategoryResource($category))->resolve(),
            'parent' => $category->parent ? ['name' => $category->parent->name, 'slug' => $category->parent->slug] : null,
        ]);
    }
}
