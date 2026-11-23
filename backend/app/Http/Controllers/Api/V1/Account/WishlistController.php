<?php

namespace App\Http\Controllers\Api\V1\Account;

use App\Http\Controllers\Controller;
use App\Http\Resources\Marketplace\ProductCardResource;
use App\Http\Responses\ApiResponse;
use App\Models\Product;
use App\Models\Wishlist;
use App\Services\Marketplace\ProductCatalogService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WishlistController extends Controller
{
    /** GET /wishlist – visible products only (hidden/unpublished items are kept but not shown) */
    public function index(Request $request, ProductCatalogService $catalog): JsonResponse
    {
        $wishlist = Wishlist::query()->firstOrCreate(['user_id' => $request->user()->id]);
        $products = $catalog->cardQuery()
            ->join('wishlist_items', 'wishlist_items.product_id', '=', 'products.id')
            ->where('wishlist_items.wishlist_id', $wishlist->id)
            ->orderByDesc('wishlist_items.created_at')
            ->paginate(24);

        return ApiResponse::success(ProductCardResource::collection($products));
    }

    /** GET /wishlist/ids – lightweight list for heart icons */
    public function ids(Request $request): JsonResponse
    {
        $ids = $request->user()->wishlist?->items()->pluck('product_id') ?? collect();

        return ApiResponse::success($ids->values());
    }

    /** POST /wishlist/{product} – idempotent */
    public function store(Request $request, int $product): JsonResponse
    {
        $model = Product::query()->visible()->findOrFail($product);
        $wishlist = Wishlist::query()->firstOrCreate(['user_id' => $request->user()->id]);
        $wishlist->products()->syncWithoutDetaching([$model->id]);

        return ApiResponse::success(['product_id' => $model->id, 'in_wishlist' => true], 'Saved to your wishlist.');
    }

    /** DELETE /wishlist/{product} – idempotent */
    public function destroy(Request $request, int $product): JsonResponse
    {
        $request->user()->wishlist?->products()->detach($product);

        return ApiResponse::success(['product_id' => $product, 'in_wishlist' => false], 'Removed from your wishlist.');
    }
}
