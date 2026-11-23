<?php

namespace App\Notifications\Order;

use App\Models\Order;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

/** Tells a seller that a new order needs fulfilment. Payload is deliberately small. */
class OrderPlacedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public readonly Order $order) {}

    /** @return list<string> */
    public function via(object $notifiable): array
    {
        return ['database', 'broadcast'];
    }

    /** @return array<string, mixed> */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => 'order.placed',
            'title' => 'New order received',
            'body' => 'Order '.$this->order->reference_number.' is waiting to be confirmed.',
            'order_id' => $this->order->id,
            'reference_number' => $this->order->reference_number,
            'total_amount' => (float) $this->order->total_amount,
            'url' => '/seller/orders/'.$this->order->id,
        ];
    }
}
