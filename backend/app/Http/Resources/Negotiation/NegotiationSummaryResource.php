<?php

namespace App\Http\Resources\Negotiation;

use App\Models\Negotiation;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Row used by the negotiation inbox for both customers and sellers.
 *
 * @mixin Negotiation
 */
class NegotiationSummaryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $userId = $request->user()?->id;
        $isSeller = $this->store?->user_id === $userId;

        return [
            'id' => $this->id,
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'role' => $isSeller ? 'seller' : 'customer',
            'quantity' => (int) $this->quantity,
            'product' => $this->whenLoaded('product', fn () => [
                'id' => $this->product->id,
                'name' => $this->product->name,
                'slug' => $this->product->slug,
                'price' => (float) $this->product->price,
                'image_url' => $this->product->primaryImage?->thumbnailUrl(),
            ]),
            'variant' => $this->whenLoaded('variant', fn () => $this->variant ? [
                'id' => $this->variant->id,
                'sku' => $this->variant->sku,
                'attributes' => $this->variant->getAttribute('attributes'),
                'price' => (float) ($this->variant->price ?? $this->product->price),
            ] : null),
            'store' => $this->whenLoaded('store', fn () => [
                'id' => $this->store->id,
                'name' => $this->store->name,
                'slug' => $this->store->slug,
                'logo_url' => $this->store->logoUrl(),
            ]),
            'customer' => $this->whenLoaded('customer', fn () => [
                'id' => $this->customer->id,
                'name' => $this->customer->name,
                'avatar_url' => $this->customer->avatarUrl(),
            ]),
            'latest_offer' => $this->whenLoaded('latestOffer', fn () => $this->latestOffer
                ? new NegotiationOfferResource($this->latestOffer->loadMissing('sender'))
                : null),
            'accepted_offer' => $this->whenLoaded('acceptedOffer', fn () => $this->acceptedOffer
                ? new NegotiationOfferResource($this->acceptedOffer->loadMissing('sender'))
                : null),
            'pending_offer_id' => $this->whenLoaded('pendingOffer', fn () => $this->pendingOffer?->id),
            'unread_count' => (int) ($this->unread_count ?? 0),
            'converted_order_id' => $this->converted_order_id,
            'expires_at' => $this->expires_at?->toIso8601String(),
            'last_activity_at' => $this->last_activity_at?->toIso8601String(),
            'closed_at' => $this->closed_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
