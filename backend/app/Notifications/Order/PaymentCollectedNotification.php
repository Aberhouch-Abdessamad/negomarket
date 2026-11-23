<?php

namespace App\Notifications\Order;

use App\Models\Order;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

/** Confirms that the seller (or courier) recorded the cash-on-delivery payment. */
class PaymentCollectedNotification extends Notification implements ShouldQueue
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
            'kind' => 'order.payment_collected',
            'title' => 'Payment recorded',
            'body' => 'Cash for order '.$this->order->reference_number.' was marked as collected.',
            'order_id' => $this->order->id,
            'reference_number' => $this->order->reference_number,
            'total_amount' => (float) $this->order->total_amount,
            'url' => '/orders/'.$this->order->id,
        ];
    }
}
