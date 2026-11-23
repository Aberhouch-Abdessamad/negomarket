<?php

namespace App\Services\Inventory;

use App\Enums\InventoryMovementType;
use App\Models\InventoryMovement;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * The only place where stock changes. Every change:
 *  - runs in a transaction with row locks (SELECT … FOR UPDATE),
 *  - never lets stock go below zero (also enforced by UNSIGNED columns),
 *  - writes an inventory_movements ledger row (idempotent per reference + type),
 *  - keeps product stock equal to the sum of its variants when variants exist.
 */
class InventoryService
{
    /**
     * Apply a signed quantity change.
     *
     * @throws ValidationException when stock would become negative
     */
    public function adjust(
        Product $product,
        ?ProductVariant $variant,
        int $change,
        InventoryMovementType $type,
        ?User $actor = null,
        ?Model $reference = null,
        ?string $note = null,
    ): InventoryMovement {
        return DB::transaction(function () use ($product, $variant, $change, $type, $actor, $reference, $note) {
            /** @var Product $lockedProduct */
            $lockedProduct = Product::query()->whereKey($product->id)->lockForUpdate()->firstOrFail();
            $lockedVariant = $variant ? ProductVariant::query()->whereKey($variant->id)->lockForUpdate()->firstOrFail() : null;

            $target = $lockedVariant ?? $lockedProduct;
            $before = (int) $target->stock_quantity;
            $after = $before + $change;

            if ($after < 0) {
                throw ValidationException::withMessages([
                    'stock_quantity' => ["Insufficient stock: {$before} available, {$change} requested."],
                ]);
            }

            $target->forceFill(['stock_quantity' => $after])->save();

            if ($lockedVariant) {
                $this->syncProductStockFromVariants($lockedProduct);
            }

            $movement = new InventoryMovement;
            $movement->forceFill([
                'product_id' => $lockedProduct->id,
                'product_variant_id' => $lockedVariant?->id,
                'type' => $type,
                'quantity_change' => $change,
                'quantity_before' => $before,
                'quantity_after' => $after,
                'reference_type' => $reference?->getMorphClass(),
                'reference_id' => $reference?->getKey(),
                'user_id' => $actor?->id,
                'note' => $note,
            ])->save();

            $product->setRawAttributes($lockedProduct->getAttributes(), true);
            $variant?->setRawAttributes($lockedVariant->getAttributes(), true);

            return $movement;
        });
    }

    /** Set an absolute stock level (seller edit); records the difference as an adjustment. */
    public function setLevel(Product $product, ?ProductVariant $variant, int $level, ?User $actor = null, ?string $note = null): ?InventoryMovement
    {
        $current = (int) ($variant ?? $product)->fresh()->stock_quantity;
        $delta = $level - $current;
        if ($delta === 0) {
            return null;
        }

        return $this->adjust($product, $variant, $delta, $delta > 0 ? InventoryMovementType::Restock : InventoryMovementType::Adjustment, $actor, null, $note ?? 'Stock level updated by seller');
    }

    /** Initial stock for a newly created product/variant. */
    public function initial(Product $product, ?ProductVariant $variant, int $quantity, ?User $actor = null): ?InventoryMovement
    {
        if ($quantity <= 0) {
            return null;
        }

        return $this->adjust($product, $variant, $quantity, InventoryMovementType::Initial, $actor, null, 'Initial stock');
    }

    public function syncProductStockFromVariants(Product $product): void
    {
        $total = (int) ProductVariant::query()->where('product_id', $product->id)->sum('stock_quantity');
        $product->forceFill(['stock_quantity' => $total])->save();
    }
}
