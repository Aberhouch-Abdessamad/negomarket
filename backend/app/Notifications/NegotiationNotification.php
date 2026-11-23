<?php

namespace App\Notifications;

use App\Models\Negotiation;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

/**
 * Database + realtime notification for anything that happens in a negotiation.
 * The payload is intentionally small: the SPA fetches the full thread from the API.
 */
class NegotiationNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly Negotiation $negotiation,
        public readonly string $kind,
        public readonly string $title,
        public readonly string $body,
        public readonly ?int $offerId = null,
    ) {}

    /** @return list<string> */
    public function via(object $notifiable): array
    {
        return ['database', 'broadcast'];
    }

    /** @return array<string, mixed> */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => $this->kind,
            'title' => $this->title,
            'body' => $this->body,
            'negotiation_id' => $this->negotiation->id,
            'offer_id' => $this->offerId,
            'url' => '/negotiations/'.$this->negotiation->id,
        ];
    }

    /** @return array<string, mixed> */
    public function toBroadcast(object $notifiable): array
    {
        return $this->toArray($notifiable);
    }

    public function broadcastAs(): string
    {
        return 'notification.received';
    }
}
