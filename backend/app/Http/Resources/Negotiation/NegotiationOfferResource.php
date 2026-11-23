<?php

namespace App\Http\Resources\Negotiation;

use App\Models\NegotiationOffer;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A single structured price offer. Offers are append-only, so this resource
 * never hides history. The seller's private minimum price is never exposed.
 *
 * @mixin NegotiationOffer
 */
class NegotiationOfferResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'negotiation_id' => $this->negotiation_id,
            'amount' => (float) $this->amount,
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'sender_role' => $this->sender_role->value,
            'sender' => $this->whenLoaded('sender', fn () => [
                'id' => $this->sender->id,
                'name' => $this->sender->name,
                'avatar_url' => $this->sender->avatarUrl(),
            ]),
            'sender_id' => $this->sender_id,
            'parent_offer_id' => $this->parent_offer_id,
            'message' => $this->message,
            'expires_at' => $this->expires_at?->toIso8601String(),
            'is_expired' => $this->status->value === 'pending' && $this->expires_at?->isPast(),
            'responded_at' => $this->responded_at?->toIso8601String(),
            'responded_by' => $this->responded_by,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
