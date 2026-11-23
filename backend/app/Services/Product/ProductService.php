<?php

namespace App\Services\Product;

use App\Enums\InventoryMovementType;
use App\Enums\ProductStatus;
use App\Enums\VariantStatus;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Setting;
use App\Models\Store;
use App\Models\User;
use App\Notifications\Catalog\ProductModerationNotification;
use App\Services\Audit\ActivityLogger;
use App\Services\Inventory\InventoryService;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Seller-side product lifecycle: create/update (with variants and stock via
 * the inventory ledger), publish/unpublish, archive/delete, admin moderation.
 */
class ProductService
{
    public function __construct(
        private readonly InventoryService $inventory,
        private readonly ActivityLogger $activity,
    ) {}

    /** @param array<string, mixed> $data validated ProductRequest data */
    public function create(Store $store, array $data, User $actor): Product
    {
        $product = DB::transaction(function () use ($store, $data, $actor) {
            $product = new Product(Arr::only($data, ['category_id', 'name', 'sku', 'description', 'price', 'minimum_price', 'allow_negotiation']));
            $product->forceFill([
                'store_id' => $store->id,
                'slug' => $this->uniqueSlug($data['name']),
                'status' => ProductStatus::Draft,
                'stock_quantity' => 0,
            ])->save();

            if (! empty($data['variants'])) {
                $this->syncVariants($product, $data['variants'], $actor);
            } else {
                $this->inventory->initial($product, null, (int) $data['stock_quantity'], $actor);
            }

            return $product;
        });

        $this->activity->log('product.created', $actor, $product, ['sku' => $product->sku]);

        return $product->refresh();
    }

    /** @param array<string, mixed> $data */
    public function update(Product $product, array $data, User $actor): Product
    {
        DB::transaction(function () use ($product, $data, $actor) {
            $product->fill(Arr::only($data, ['category_id', 'name', 'sku', 'description', 'price', 'minimum_price', 'allow_negotiation']));
            if ($product->isDirty('name') && $product->status === ProductStatus::Draft) {
                $product->forceFill(['slug' => $this->uniqueSlug($data['name'], $product->id)]);
            }
            $product->save();

            $hadVariants = $product->variants()->exists();
            $variants = $data['variants'] ?? [];

            if ($variants) {
                if (! $hadVariants && $product->stock_quantity > 0) {
                    // Switching to per-variant stock: zero the product-level stock in the ledger first.
                    $this->inventory->adjust($product, null, -$product->stock_quantity, InventoryMovementType::Adjustment, $actor, null, 'Moved to per-variant stock');
                }
                $this->syncVariants($product, $variants, $actor);
            } else {
                if ($hadVariants) {
                    $this->removeVariants($product, $product->variants()->get(), $actor);
                }
                $this->inventory->setLevel($product, null, (int) $data['stock_quantity'], $actor);
            }
        });

        $this->activity->log('product.updated', $actor, $product, ['changes' => array_keys($product->getChanges())]);

        return $product->refresh();
    }

    /**
     * Seller submits the product. With moderation on it goes to pending_review,
     * otherwise it is published immediately. Only active stores reach this (middleware).
     */
    public function publish(Product $product, User $actor): Product
    {
        if (! in_array($product->status, [ProductStatus::Draft, ProductStatus::Rejected, ProductStatus::Archived], true)) {
            throw ValidationException::withMessages(['status' => 'Only draft, rejected or archived products can be submitted.']);
        }
        if (! $product->images()->exists()) {
            throw ValidationException::withMessages(['images' => 'Add at least one product image before publishing.']);
        }

        $moderated = (bool) Setting::get('products.require_moderation', true);
        $product->forceFill($moderated
            ? ['status' => ProductStatus::PendingReview, 'rejection_reason' => null]
            : ['status' => ProductStatus::Published, 'rejection_reason' => null, 'published_at' => $product->published_at ?? now()],
        )->save();

        $this->activity->log($moderated ? 'product.submitted' : 'product.published', $actor, $product);

        return $product;
    }

    /** Take a product off the marketplace (back to draft). */
    public function unpublish(Product $product, User $actor): Product
    {
        $product->forceFill(['status' => ProductStatus::Draft])->save();
        $this->activity->log('product.unpublished', $actor, $product);

        return $product;
    }

    /**
     * Products that were ever ordered are archived (order history keeps a
     * valid FK); others are soft-deleted.
     *
     * @return 'archived'|'deleted'
     */
    public function delete(Product $product, User $actor): string
    {
        if ($product->orderItems()->exists()) {
            $product->forceFill(['status' => ProductStatus::Archived])->save();
            $this->activity->log('product.archived', $actor, $product);

            return 'archived';
        }

        $product->delete();
        $this->activity->log('product.deleted', $actor, $product);

        return 'deleted';
    }

    public function approve(Product $product, User $admin): Product
    {
        $this->assertPending($product);
        $product->forceFill(['status' => ProductStatus::Published, 'rejection_reason' => null, 'published_at' => $product->published_at ?? now()])->save();
        $this->activity->log('product.approved', $admin, $product);
        $product->store->owner->notify(new ProductModerationNotification($product, approved: true));

        return $product;
    }

    public function reject(Product $product, User $admin, string $reason): Product
    {
        $this->assertPending($product);
        $product->forceFill(['status' => ProductStatus::Rejected, 'rejection_reason' => $reason])->save();
        $this->activity->log('product.rejected', $admin, $product, ['reason' => $reason]);
        $product->store->owner->notify(new ProductModerationNotification($product, approved: false));

        return $product;
    }

    private function assertPending(Product $product): void
    {
        if ($product->status !== ProductStatus::PendingReview) {
            throw ValidationException::withMessages(['status' => 'Only products pending review can be moderated.']);
        }
    }

    /** @param list<array<string, mixed>> $rows */
    private function syncVariants(Product $product, array $rows, User $actor): void
    {
        $existing = $product->variants()->get()->keyBy('id');
        $keep = [];

        foreach ($rows as $row) {
            $attributes = ['sku' => strtoupper($row['sku']), 'attributes' => $row['attributes'], 'price' => $row['price'] ?? null, 'status' => $row['status'] ?? VariantStatus::Active->value];

            if (! empty($row['id']) && $existing->has($row['id'])) {
                $variant = $existing[$row['id']];
                $variant->fill($attributes)->save();
                $this->inventory->setLevel($product, $variant, (int) $row['stock_quantity'], $actor);
            } else {
                $variant = new ProductVariant($attributes);
                $variant->product()->associate($product);
                $variant->forceFill(['stock_quantity' => 0])->save();
                $this->inventory->initial($product, $variant, (int) $row['stock_quantity'], $actor);
            }
            $keep[] = $variant->id;
        }

        $this->removeVariants($product, $existing->except($keep), $actor);
        $this->inventory->syncProductStockFromVariants($product);
    }

    private function removeVariants(Product $product, $variants, User $actor): void
    {
        foreach ($variants as $variant) {
            if ($variant->stock_quantity > 0) {
                $this->inventory->adjust($product, $variant, -$variant->stock_quantity, InventoryMovementType::Adjustment, $actor, null, 'Variant removed');
            }
            $variant->delete();
        }
        $this->inventory->syncProductStockFromVariants($product);
    }

    private function uniqueSlug(string $name, ?int $ignoreId = null): string
    {
        $base = Str::slug(Str::limit($name, 80, '')) ?: 'product';
        do {
            $slug = $base.'-'.Str::lower(Str::random(5));
        } while (Product::withTrashed()->where('slug', $slug)->when($ignoreId, fn ($q) => $q->whereKeyNot($ignoreId))->exists());

        return $slug;
    }
}
