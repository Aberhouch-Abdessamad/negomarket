<?php

namespace App\Notifications\Catalog;

use App\Models\Product;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

class ProductModerationNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public readonly Product $product, public readonly bool $approved) {}

    /** @return list<string> */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /** @return array<string, mixed> */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => $this->approved ? 'product.approved' : 'product.rejected',
            'title' => $this->approved ? 'Product approved' : 'Product needs changes',
            'body' => $this->approved
                ? "“{$this->product->name}” is now live on the marketplace."
                : "“{$this->product->name}” was not approved: {$this->product->rejection_reason}",
            'product_id' => $this->product->id,
            'product_slug' => $this->product->slug,
        ];
    }
}
