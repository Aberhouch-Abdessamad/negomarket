<?php

namespace App\Events;

use App\Models\Message;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class MessageSent implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public readonly Message $message) {}

    /** @return array<int, PrivateChannel> */
    public function broadcastOn(): array
    {
        return [new PrivateChannel('negotiations.'.$this->message->negotiation_id)];
    }

    public function broadcastAs(): string
    {
        return 'message.sent';
    }

    /** @return array<string, mixed> */
    public function broadcastWith(): array
    {
        return [
            'id' => $this->_id(),
            'negotiation_id' => $this->message->negotiation_id,
            'body' => $this->message->message,
            'type' => $this->message->message_type->value,
            'offer_id' => $this->message->offer_id,
            'client_message_id' => $this->message->client_message_id,
            'read_at' => $this->message->read_at?->toIso8601String(),
            'created_at' => $this->message->created_at->toIso8601String(),
            'sender' => [
                'id' => $this->message->sender_id,
                'name' => $this->message->sender?->name,
                'avatar_url' => $this->message->sender?->avatarUrl(),
            ],
        ];
    }

    private function _id(): int
    {
        return (int) $this->message->getKey();
    }
}
