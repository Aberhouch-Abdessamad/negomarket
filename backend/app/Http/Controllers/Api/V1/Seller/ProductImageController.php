<?php

namespace App\Http\Controllers\Api\V1\Seller;

use App\Http\Controllers\Controller;
use App\Http\Requests\Seller\ProductImagesRequest;
use App\Http\Resources\Seller\SellerProductResource;
use App\Http\Responses\ApiResponse;
use App\Models\Product;
use App\Models\ProductImage;
use App\Services\Product\ProductImageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class ProductImageController extends Controller
{
    public function __construct(private readonly ProductImageService $images) {}

    /** POST /seller/products/{product}/images (multipart images[]) */
    public function store(ProductImagesRequest $request, Product $product): JsonResponse
    {
        Gate::authorize('manage', $product);
        $this->images->add($product, $request->file('images'));

        return ApiResponse::created($this->resource($product), 'Images uploaded.');
    }

    /** PATCH /seller/products/{product}/images/order  { image_ids: [3, 1, 2] } */
    public function reorder(Request $request, Product $product): JsonResponse
    {
        Gate::authorize('manage', $product);
        $ids = $request->validate(['image_ids' => ['required', 'array', 'min:1'], 'image_ids.*' => ['integer', 'distinct']])['image_ids'];
        $this->images->reorder($product, $ids);

        return ApiResponse::success($this->resource($product), 'Image order saved.');
    }

    /** DELETE /seller/products/{product}/images/{image} */
    public function destroy(Product $product, ProductImage $image): JsonResponse
    {
        Gate::authorize('manage', $product);
        abort_unless($image->product_id === $product->id, 404);
        $this->images->delete($image);

        return ApiResponse::success($this->resource($product), 'Image removed.');
    }

    private function resource(Product $product): SellerProductResource
    {
        return new SellerProductResource($product->refresh()->load(['images', 'variants', 'category:id,name']));
    }
}
