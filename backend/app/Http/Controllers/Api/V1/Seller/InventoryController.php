<?php

namespace App\Http\Controllers\Api\V1\Seller;

use App\Enums\InventoryMovementType;
use App\Enums\ProductStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Seller\InventoryAdjustRequest;
use App\Http\Resources\Seller\InventoryMovementResource;
use App\Http\Responses\ApiResponse;
use App\Models\InventoryMovement;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Services\Inventory\InventoryService;
use App\Services\Store\SellerAnalyticsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class InventoryController extends Controller
{
    public function __construct(private readonly InventoryService $inventory) {}

    /** GET /seller/inventory – one row per stock-keeping unit (product without variants, or variant) */
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'stock' => ['nullable', Rule::in(['low', 'out'])],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);
        $low = SellerAnalyticsService::LOW_STOCK_THRESHOLD;

        $products = Product::query()
            ->where('store_id', $request->user()->store->id)
            ->whereNot('status', ProductStatus::Archived)
            ->with(['variants', 'primaryImage'])
            ->when($filters['q'] ?? null, fn ($q, $t) => $q->where(fn ($w) => $w->where('name', 'like', '%'.addcslashes($t, '\\%_').'%')->orWhere('sku', 'like', strtoupper(addcslashes($t, '\\%_')).'%')))
            ->when(($filters['stock'] ?? null) === 'out', fn ($q) => $q->where(fn ($w) => $w->where('stock_quantity', 0)->orWhereHas('variants', fn ($v) => $v->where('stock_quantity', 0))))
            ->when(($filters['stock'] ?? null) === 'low', fn ($q) => $q->where(fn ($w) => $w->whereBetween('stock_quantity', [1, $low])->orWhereHas('variants', fn ($v) => $v->whereBetween('stock_quantity', [1, $low]))))
            ->orderBy('stock_quantity')->orderBy('name')
            ->paginate(25);

        $rows = $products->getCollection()->map(fn (Product $p) => [
            'product_id' => $p->id,
            'name' => $p->name,
            'sku' => $p->sku,
            'status' => $p->status->value,
            'image_url' => $p->primaryImage?->thumbnailUrl(),
            'stock_quantity' => (int) $p->stock_quantity,
            'variants' => $p->variants->map(fn (ProductVariant $v) => [
                'id' => $v->id, 'sku' => $v->sku, 'attributes' => $v->getAttribute('attributes'), 'stock_quantity' => (int) $v->stock_quantity,
            ])->values(),
        ]);

        return ApiResponse::success($rows, meta: [
            'current_page' => $products->currentPage(), 'last_page' => $products->lastPage(),
            'per_page' => $products->perPage(), 'total' => $products->total(), 'low_stock_threshold' => $low,
        ]);
    }

    /** POST /seller/inventory/adjust */
    public function adjust(InventoryAdjustRequest $request): JsonResponse
    {
        $product = Product::findOrFail($request->validated('product_id'));
        Gate::authorize('manage', $product);
        $variant = $request->validated('product_variant_id') ? ProductVariant::findOrFail($request->validated('product_variant_id')) : null;
        $qty = (int) $request->validated('quantity');
        $note = $request->validated('note');

        $movement = match ($request->validated('mode')) {
            'set' => $this->inventory->setLevel($product, $variant, $qty, $request->user(), $note),
            'add' => $this->inventory->adjust($product, $variant, $qty, InventoryMovementType::Restock, $request->user(), null, $note ?? 'Restock'),
            'remove' => $this->inventory->adjust($product, $variant, -$qty, InventoryMovementType::Adjustment, $request->user(), null, $note ?? 'Manual adjustment'),
        };

        return ApiResponse::success(
            $movement ? new InventoryMovementResource($movement->load(['product', 'variant', 'user'])) : null,
            $movement ? 'Stock updated.' : 'Stock level unchanged.',
        );
    }

    /** GET /seller/inventory/movements?product_id= */
    public function movements(Request $request): JsonResponse
    {
        $filters = $request->validate(['product_id' => ['nullable', 'integer'], 'type' => ['nullable', Rule::enum(InventoryMovementType::class)]]);

        $movements = InventoryMovement::query()
            ->whereHas('product', fn ($q) => $q->withTrashed()->where('store_id', $request->user()->store->id))
            ->when($filters['product_id'] ?? null, fn ($q, $id) => $q->where('product_id', $id))
            ->when($filters['type'] ?? null, fn ($q, $t) => $q->where('type', $t))
            ->with(['product' => fn ($q) => $q->withTrashed(), 'variant', 'user:id,name'])
            ->latest('id')
            ->paginate(30);

        return ApiResponse::success(InventoryMovementResource::collection($movements));
    }
}
