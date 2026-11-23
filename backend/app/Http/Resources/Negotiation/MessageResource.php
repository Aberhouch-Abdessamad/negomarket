<?php

namespace App\Http\Resources\Negotiation;

use App\Models\Message;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Message
 */
class MessageResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'negotiation_id' => $this->negotiation_id,
            'body' => $this->message,
            'type' => $this->message_type->value,
            'offer_id' => $this->offer_id,
            'client_message_id' => $this->client_message_id,
            'read_at' => $this->read_at?->toIso8601String(),
            'sender_id' => $this->sender_id,
            'sender' => $this->whenLoaded('sender', fn () => [
                'id' => $this->sender->id,
                'name' => $this->sender->name,
                'avatar_url' => $this->sender->avatarUrl(),
            ]),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
