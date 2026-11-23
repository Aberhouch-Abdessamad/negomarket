<?php

namespace App\Http\Resources\Seller;

use App\Models\Product;
use App\Models\ProductImage;
use App\Models\ProductVariant;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Product as seen by its OWNER. This is the only resource that exposes
 * minimum_price; it is returned exclusively from /seller/* (owner-checked).
 *
 * @mixin Product
 */
class SellerProductResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'sku' => $this->sku,
            'description' => $this->description,
            'category' => $this->whenLoaded('category', fn () => ['id' => $this->category->id, 'name' => $this->category->name]),
            'category_id' => $this->category_id,
            'store' => $this->whenLoaded('store', fn () => ['id' => $this->store->id, 'name' => $this->store->name, 'slug' => $this->store->slug]),
            'price' => (float) $this->price,
            'minimum_price' => $this->minimum_price !== null ? (float) $this->minimum_price : null,
            'allow_negotiation' => $this->allow_negotiation,
            'stock_quantity' => (int) $this->stock_quantity,
            'status' => $this->status->value,
            'rejection_reason' => $this->rejection_reason,
            'featured' => $this->featured,
            'views_count' => (int) $this->views_count,
            'sales_count' => (int) $this->sales_count,
            'rating_avg' => (float) $this->rating_avg,
            'images' => $this->whenLoaded('images', fn () => $this->images->map(fn (ProductImage $i) => [
                'id' => $i->id, 'url' => $i->url(), 'thumbnail_url' => $i->thumbnailUrl(), 'sort_order' => $i->sort_order,
            ])),
            'primary_image_url' => $this->whenLoaded('primaryImage', fn () => $this->primaryImage?->thumbnailUrl()),
            'variants' => $this->whenLoaded('variants', fn () => $this->variants->map(fn (ProductVariant $v) => [
                'id' => $v->id, 'sku' => $v->sku, 'attributes' => $v->getAttribute('attributes'),
                'price' => $v->price !== null ? (float) $v->price : null,
                'stock_quantity' => (int) $v->stock_quantity, 'status' => $v->status->value,
            ])),
            'published_at' => $this->published_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
