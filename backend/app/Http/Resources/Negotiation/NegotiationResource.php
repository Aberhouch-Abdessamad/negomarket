<?php

namespace App\Http\Resources\Negotiation;

use App\Models\Negotiation;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Full negotiation thread: product context, every historical offer, the
 * accepted offer and (when loaded) the latest chat messages.
 *
 * @mixin Negotiation
 */
class NegotiationResource extends JsonResource
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
                'sku' => $this->product->sku,
                'price' => (float) $this->product->price,
                'allow_negotiation' => $this->product->allow_negotiation,
                'stock_quantity' => (int) $this->product->stock_quantity,
                'status' => $this->product->status->value,
                'image_url' => $this->product->primaryImage?->url(),
                'thumbnail_url' => $this->product->primaryImage?->thumbnailUrl(),
            ]),
            'variant' => $this->whenLoaded('variant', fn () => $this->variant ? [
                'id' => $this->variant->id,
                'sku' => $this->variant->sku,
                'attributes' => $this->variant->getAttribute('attributes'),
                'price' => (float) ($this->variant->price ?? $this->product->price),
                'stock_quantity' => (int) $this->variant->stock_quantity,
                'status' => $this->variant->status->value,
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
            'offers' => NegotiationOfferResource::collection($this->whenLoaded('offers')),
            'accepted_offer' => $this->whenLoaded('acceptedOffer', fn () => $this->acceptedOffer
                ? new NegotiationOfferResource($this->acceptedOffer->loadMissing('sender'))
                : null),
            'pending_offer' => $this->whenLoaded('pendingOffer', fn () => $this->pendingOffer
                ? new NegotiationOfferResource($this->pendingOffer->loadMissing('sender'))
                : null),
            'messages' => MessageResource::collection($this->whenLoaded('messages')),
            'unread_count' => (int) ($this->unread_count ?? 0),
            'converted_order_id' => $this->converted_order_id,
            'expires_at' => $this->expires_at?->toIso8601String(),
            'last_activity_at' => $this->last_activity_at?->toIso8601String(),
            'closed_at' => $this->closed_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
