<?php

namespace App\Http\Controllers\Api\V1\Marketplace;

use App\Http\Controllers\Controller;
use App\Http\Requests\Marketplace\ProductIndexRequest;
use App\Http\Resources\Marketplace\ProductCardResource;
use App\Http\Resources\Marketplace\ProductDetailResource;
use App\Http\Resources\Marketplace\ReviewResource;
use App\Http\Responses\ApiResponse;
use App\Models\Product;
use App\Services\Marketplace\ProductCatalogService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProductController extends Controller
{
    public function __construct(private readonly ProductCatalogService $catalog) {}

    /** GET /products */
    public function index(ProductIndexRequest $request): JsonResponse
    {
        return ApiResponse::success(ProductCardResource::collection($this->catalog->search($request->filters())));
    }

    /** GET /products/{slug} */
    public function show(string $slug): JsonResponse
    {
        $product = $this->catalog->findBySlug($slug);
        $this->catalog->recordView($product);

        return ApiResponse::success(new ProductDetailResource($product), meta: [
            'rating_breakdown' => $this->catalog->ratingBreakdown($product),
        ]);
    }

    /** GET /products/{slug}/related */
    public function related(string $slug): JsonResponse
    {
        $product = $this->catalog->findBySlug($slug);

        return ApiResponse::success(ProductCardResource::collection($this->catalog->related($product)));
    }

    /** GET /products/{product}/reviews  ({product} = numeric id or slug) */
    public function reviews(Request $request, string $product): JsonResponse
    {
        $filters = $request->validate([
            'per_page' => ['nullable', 'integer', 'between:1,50'],
        ]);

        $model = Product::query()->visible()
            ->where(fn ($q) => ctype_digit($product) ? $q->whereKey((int) $product) : $q->where('slug', $product))
            ->firstOrFail();

        return ApiResponse::success(ReviewResource::collection($this->catalog->reviews($model, (int) ($filters['per_page'] ?? 10))));
    }
}
