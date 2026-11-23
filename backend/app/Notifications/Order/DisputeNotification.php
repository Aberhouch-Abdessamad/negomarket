<?php

namespace App\Notifications\Order;

use App\Models\Dispute;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

/** Sent to the other side when a dispute is opened or a new message is posted. */
class DisputeNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly Dispute $dispute,
        public readonly string $event,
        public readonly ?string $excerpt = null,
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
            'kind' => 'dispute.'.$this->event,
            'title' => $this->event === 'opened' ? 'A dispute was opened' : 'New dispute message',
            'body' => $this->event === 'opened'
                ? 'A customer opened a dispute about order '.$this->dispute->order?->reference_number.'.'
                : 'A new message was added to a dispute.',
            'dispute_id' => $this->dispute->id,
            'order_id' => $this->dispute->order_id,
            'reason' => $this->dispute->reason,
            'excerpt' => $this->excerpt,
            'url' => '/disputes/'.$this->dispute->id,
        ];
    }
}
