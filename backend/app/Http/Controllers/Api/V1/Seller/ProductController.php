<?php

namespace App\Http\Controllers\Api\V1\Seller;

use App\Enums\ProductStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Seller\ProductRequest;
use App\Http\Resources\Seller\SellerProductResource;
use App\Http\Responses\ApiResponse;
use App\Models\Product;
use App\Services\Product\ProductService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class ProductController extends Controller
{
    public function __construct(private readonly ProductService $products) {}

    /** GET /seller/products */
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', Rule::enum(ProductStatus::class)],
            'stock' => ['nullable', Rule::in(['in', 'low', 'out'])],
            'sort' => ['nullable', Rule::in(['newest', 'name', 'price', 'stock'])],
            'per_page' => ['nullable', 'integer', 'between:1,50'],
        ]);

        $query = Product::query()
            ->where('store_id', $request->user()->store->id)
            ->with(['primaryImage', 'category:id,name'])
            ->when($filters['q'] ?? null, fn ($q, $term) => $q->where(fn ($w) => $w
                ->where('name', 'like', '%'.addcslashes($term, '\\%_').'%')->orWhere('sku', strtoupper($term))))
            ->when($filters['status'] ?? null, fn ($q, $s) => $q->where('status', $s))
            ->when(($filters['stock'] ?? null) === 'out', fn ($q) => $q->where('stock_quantity', 0))
            ->when(($filters['stock'] ?? null) === 'low', fn ($q) => $q->whereBetween('stock_quantity', [1, 5]))
            ->when(($filters['stock'] ?? null) === 'in', fn ($q) => $q->where('stock_quantity', '>', 0));

        match ($filters['sort'] ?? 'newest') {
            'name' => $query->orderBy('name'),
            'price' => $query->orderBy('price'),
            'stock' => $query->orderBy('stock_quantity'),
            default => $query->latest('id'),
        };

        return ApiResponse::success(SellerProductResource::collection($query->paginate($filters['per_page'] ?? 20)));
    }

    /** POST /seller/products */
    public function store(ProductRequest $request): JsonResponse
    {
        $product = $this->products->create($request->user()->store, $request->validated(), $request->user());

        return ApiResponse::created($this->resource($product), 'Product created as a draft.');
    }

    /** GET /seller/products/{product} */
    public function show(Product $product): JsonResponse
    {
        Gate::authorize('manage', $product);

        return ApiResponse::success($this->resource($product));
    }

    /** PUT /seller/products/{product} */
    public function update(ProductRequest $request, Product $product): JsonResponse
    {
        Gate::authorize('manage', $product);
        $product = $this->products->update($product, $request->validated(), $request->user());

        return ApiResponse::success($this->resource($product), 'Product updated.');
    }

    /** POST /seller/products/{product}/publish */
    public function publish(Request $request, Product $product): JsonResponse
    {
        Gate::authorize('manage', $product);
        $product = $this->products->publish($product, $request->user());

        return ApiResponse::success(
            $this->resource($product),
            $product->status === ProductStatus::Published ? 'Product published.' : 'Product submitted for review.',
        );
    }

    /** POST /seller/products/{product}/unpublish */
    public function unpublish(Request $request, Product $product): JsonResponse
    {
        Gate::authorize('manage', $product);

        return ApiResponse::success($this->resource($this->products->unpublish($product, $request->user())), 'Product moved back to draft.');
    }

    /** DELETE /seller/products/{product} */
    public function destroy(Request $request, Product $product): JsonResponse
    {
        Gate::authorize('manage', $product);
        $result = $this->products->delete($product, $request->user());

        return ApiResponse::success(['result' => $result], $result === 'archived'
            ? 'Product archived (it has existing orders).'
            : 'Product deleted.');
    }

    private function resource(Product $product): SellerProductResource
    {
        return new SellerProductResource($product->load(['images', 'variants', 'category:id,name']));
    }
}
