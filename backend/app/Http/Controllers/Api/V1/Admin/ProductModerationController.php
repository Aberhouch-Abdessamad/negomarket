<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\ProductStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\Seller\SellerProductResource;
use App\Http\Responses\ApiResponse;
use App\Models\Product;
use App\Services\Product\ProductService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Admin moderation endpoints (the admin UI arrives in Phase 10). */
class ProductModerationController extends Controller
{
    public function __construct(private readonly ProductService $products) {}

    /** GET /admin/products/moderation – queue of products pending review */
    public function index(Request $request): JsonResponse
    {
        $products = Product::query()
            ->where('status', ProductStatus::PendingReview)
            ->with(['images', 'variants', 'category:id,name', 'store:id,name,slug'])
            ->oldest('updated_at')
            ->paginate(20);

        return ApiResponse::success(SellerProductResource::collection($products));
    }

    /** PATCH /admin/products/{product}/approve */
    public function approve(Request $request, Product $product): JsonResponse
    {
        return ApiResponse::success(new SellerProductResource($this->products->approve($product, $request->user())), 'Product approved and published.');
    }

    /** PATCH /admin/products/{product}/reject  { reason } */
    public function reject(Request $request, Product $product): JsonResponse
    {
        $reason = $request->validate(['reason' => ['required', 'string', 'min:5', 'max:255']])['reason'];

        return ApiResponse::success(new SellerProductResource($this->products->reject($product, $request->user(), $reason)), 'Product rejected.');
    }
}
