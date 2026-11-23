<?php

namespace App\Events;

use App\Models\Negotiation;
use App\Models\NegotiationOffer;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Base class for realtime negotiation offer updates.
 * Properties are not readonly: SerializesModels restores them from the
 * subclass scope, which PHP 8.3 forbids for readonly parent properties.
 */
abstract class NegotiationOfferEvent implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public Negotiation $negotiation,
        public NegotiationOffer $offer,
    ) {}

    /** @return array<int, PrivateChannel> */
    public function broadcastOn(): array
    {
        return [new PrivateChannel('negotiations.'.$this->negotiation->id)];
    }

    /** @return array<string, mixed> */
    public function broadcastWith(): array
    {
        return [
            'negotiation_id' => $this->negotiation->id,
            'negotiation_status' => $this->negotiation->status->value,
            'offer' => [
                'id' => $this->offer->id,
                'amount' => (float) $this->offer->amount,
                'status' => $this->offer->status->value,
                'sender_role' => $this->offer->sender_role->value,
                'sender' => [
                    'id' => $this->offer->sender_id,
                    'name' => $this->offer->sender?->name,
                ],
                'parent_offer_id' => $this->offer->parent_offer_id,
                'message' => $this->offer->message,
                'expires_at' => $this->offer->expires_at?->toIso8601String(),
                'created_at' => $this->offer->created_at?->toIso8601String(),
            ],
        ];
    }
}
