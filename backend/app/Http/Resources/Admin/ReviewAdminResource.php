<?php

namespace App\Http\Resources\Admin;

use App\Models\ProductReview;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin ProductReview */
class ReviewAdminResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'rating' => $this->rating,
            'comment' => $this->comment,
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'author' => $this->whenLoaded('author', fn () => $this->author ? [
                'id' => $this->author->id,
                'name' => $this->author->name,
                'email' => $this->author->email,
            ] : null),
            'product' => $this->whenLoaded('product', fn () => $this->product ? [
                'id' => $this->product->id,
                'name' => $this->product->name,
                'slug' => $this->product->slug,
                'store' => $this->product->relationLoaded('store') && $this->product->store ? [
                    'id' => $this->product->store->id,
                    'name' => $this->product->store->name,
                ] : null,
            ] : null),
            'order' => $this->whenLoaded('orderItem', fn () => $this->orderItem?->order ? [
                'id' => $this->orderItem->order->id,
                'reference_number' => $this->orderItem->order->reference_number,
            ] : null),
            'seller_reply' => $this->seller_reply,
            'seller_replied_at' => $this->seller_replied_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
