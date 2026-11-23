<?php

namespace App\Http\Resources\Order;

use App\Models\OrderGroup;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * One checkout ("order group") with its per-store orders.
 *
 * @mixin OrderGroup
 */
class OrderGroupResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'reference_number' => $this->reference_number,
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'payment_method' => $this->payment_method->value,
            'payment_method_label' => $this->payment_method->label(),
            'subtotal' => (float) $this->subtotal,
            'shipping_total' => (float) $this->shipping_total,
            'discount_total' => (float) $this->discount_total,
            'total_amount' => (float) $this->total_amount,
            'order_count' => $this->relationLoaded('orders') ? $this->orders->count() : null,
            'orders' => OrderResource::collection($this->whenLoaded('orders')),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
