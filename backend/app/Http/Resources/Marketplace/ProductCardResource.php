<?php

namespace App\Http\Resources\Marketplace;

use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Compact product for grids. NEVER includes minimum_price.
 *
 * @mixin Product
 */
class ProductCardResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $variantMin = $this->variants_min_price ?? null;
        $hasVariants = (int) ($this->variants_count ?? 0) > 0;
        $priceFrom = $hasVariants && $variantMin !== null ? min((float) $variantMin, (float) $this->price) : (float) $this->price;

        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'price' => (float) $this->price,
            'price_from' => $priceFrom,
            'has_variants' => $hasVariants,
            'in_stock' => $this->stock_quantity > 0,
            'allow_negotiation' => $this->allow_negotiation,
            'featured' => $this->featured,
            'rating_avg' => (float) $this->rating_avg,
            'rating_count' => (int) $this->rating_count,
            'image_url' => $this->relationLoaded('primaryImage') ? $this->primaryImage?->thumbnailUrl() : null,
            'store' => $this->whenLoaded('store', fn () => [
                'name' => $this->store->name,
                'slug' => $this->store->slug,
            ]),
            'category' => $this->whenLoaded('category', fn () => [
                'name' => $this->category->name,
                'slug' => $this->category->slug,
            ]),
        ];
    }
}
