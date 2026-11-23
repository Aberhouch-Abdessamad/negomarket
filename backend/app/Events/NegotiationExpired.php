<?php

namespace App\Events;

use App\Models\Negotiation;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class NegotiationExpired implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public readonly Negotiation $negotiation) {}

    /** @return array<int, PrivateChannel> */
    public function broadcastOn(): array
    {
        return [new PrivateChannel('negotiations.'.$this->negotiation->id)];
    }

    public function broadcastAs(): string
    {
        return 'negotiation.expired';
    }

    /** @return array<string, mixed> */
    public function broadcastWith(): array
    {
        return [
            'negotiation_id' => $this->negotiation->id,
            'status' => $this->negotiation->status->value,
            'expires_at' => $this->negotiation->expires_at?->toIso8601String(),
        ];
    }
}
