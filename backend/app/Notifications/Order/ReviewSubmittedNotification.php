<?php

namespace App\Notifications\Order;

use App\Models\ProductReview;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

/** Lets a seller know that a verified buyer left feedback on one of their products. */
class ReviewSubmittedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public readonly ProductReview $review) {}

    /** @return list<string> */
    public function via(object $notifiable): array
    {
        return ['database', 'broadcast'];
    }

    /** @return array<string, mixed> */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => 'review.submitted',
            'title' => 'New product review',
            'body' => 'A buyer rated one of your products '.$this->review->rating.'/5.',
            'review_id' => $this->review->id,
            'product_id' => $this->review->product_id,
            'rating' => $this->review->rating,
            'status' => $this->review->status->value,
            'url' => '/seller/reviews',
        ];
    }
}
