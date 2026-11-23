<?php

namespace App\Http\Resources\Marketplace;

use App\Models\ProductReview;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** Public review. Shows the author's first name + initial only. @mixin ProductReview */
class ReviewResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $parts = preg_split('/\s+/', trim((string) $this->author?->name)) ?: [];
        $display = ($parts[0] ?? 'Customer').(isset($parts[1]) ? ' '.mb_substr($parts[1], 0, 1).'.' : '');

        return [
            'id' => $this->id,
            'rating' => $this->rating,
            'comment' => $this->comment,
            'author' => $display,
            'verified_purchase' => true,
            'seller_reply' => $this->seller_reply,
            'seller_replied_at' => $this->seller_replied_at?->toIso8601String(),
            'created_at' => $this->created_at->toIso8601String(),
        ];
    }
}
