<?php

namespace App\Notifications\Order;

use App\Enums\OrderStatus;
use App\Models\Order;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

/** Tells the customer that a store moved their order forward (or cancelled it). */
class OrderStatusChangedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly Order $order,
        public readonly OrderStatus $status,
        public readonly ?string $note = null,
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
            'kind' => 'order.'.$this->status->value,
            'title' => match ($this->status) {
                OrderStatus::Confirmed => 'Order confirmed',
                OrderStatus::Processing => 'Order being prepared',
                OrderStatus::Shipped => 'Order shipped',
                OrderStatus::Delivered => 'Order delivered',
                OrderStatus::Cancelled => 'Order cancelled',
                OrderStatus::Returned => 'Order returned',
                default => 'Order updated',
            },
            'body' => 'Order '.$this->order->reference_number.' is now '.$this->status->label().($this->note ? '. '.$this->note : '.'),
            'order_id' => $this->order->id,
            'reference_number' => $this->order->reference_number,
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'note' => $this->note,
            'url' => '/orders/'.$this->order->id,
        ];
    }
}
