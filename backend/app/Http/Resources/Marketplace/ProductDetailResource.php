<?php

namespace App\Http\Resources\Marketplace;

use App\Enums\VariantStatus;
use App\Models\Product;
use App\Models\ProductImage;
use App\Models\ProductVariant;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Public product page. NEVER includes minimum_price (seller-private).
 *
 * @mixin Product
 */
class ProductDetailResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $variants = $this->variants->where('status', VariantStatus::Active)->values();

        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'sku' => $this->sku,
            'description' => $this->description,
            'price' => (float) $this->price,
            'stock_quantity' => (int) $this->stock_quantity,
            'in_stock' => $this->stock_quantity > 0,
            'allow_negotiation' => $this->allow_negotiation,
            'rating_avg' => (float) $this->rating_avg,
            'rating_count' => (int) $this->rating_count,
            'sales_count' => (int) $this->sales_count,
            'images' => $this->images->map(fn (ProductImage $image) => [
                'id' => $image->id,
                'url' => $image->url(),
                'thumbnail_url' => $image->thumbnailUrl(),
                'alt' => $image->alt_text ?? $this->name,
            ]),
            'variants' => $variants->map(fn (ProductVariant $v) => [
                'id' => $v->id,
                'sku' => $v->sku,
                'attributes' => $v->getAttribute('attributes'),
                'price' => (float) ($v->price ?? $this->price),
                'stock_quantity' => (int) $v->stock_quantity,
                'in_stock' => $v->stock_quantity > 0,
            ]),
            'variant_options' => $this->variantOptions($variants),
            'category' => [
                'name' => $this->category->name,
                'slug' => $this->category->slug,
                'parent' => $this->category->parent ? ['name' => $this->category->parent->name, 'slug' => $this->category->parent->slug] : null,
            ],
            'store' => new StoreResource($this->store),
            'published_at' => $this->published_at?->toIso8601String(),
        ];
    }

    /**
     * e.g. ["color" => ["Black", "Sand"], "size" => ["S", "M", "L"]]
     *
     * @return array<string, list<string>>
     */
    private function variantOptions($variants): array
    {
        $options = [];
        foreach ($variants as $variant) {
            foreach ((array) $variant->getAttribute('attributes') as $key => $value) {
                $options[$key][] = (string) $value;
            }
        }

        return array_map(fn ($values) => array_values(array_unique($values)), $options);
    }
}
