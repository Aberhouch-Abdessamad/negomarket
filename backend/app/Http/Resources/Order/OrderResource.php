<?php

namespace App\Http\Resources\Order;

use App\Http\Resources\Dispute\DisputeResource;
use App\Models\Order;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Order */
class OrderResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'order_group_id' => $this->order_group_id,
            'reference_number' => $this->reference_number,
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'store' => $this->whenLoaded('store', fn () => [
                'id' => $this->store->id,
                'name' => $this->store->name,
                'slug' => $this->store->slug,
                'logo_url' => $this->store->logoUrl(),
            ]),
            'customer' => $this->whenLoaded('customer', fn () => [
                'id' => $this->customer->id,
                'name' => $this->customer->name,
                'email' => $this->customer->email,
                'phone' => $this->customer->phone,
            ]),
            'subtotal' => (float) $this->subtotal,
            'shipping_cost' => (float) $this->shipping_cost,
            'discount' => (float) $this->discount,
            'total_amount' => (float) $this->total_amount,
            'customer_notes' => $this->customer_notes,
            'items' => $this->whenLoaded('items', fn () => $this->items->map(fn ($item) => [
                'id' => $item->id,
                'product_id' => $item->product_id,
                'product_name' => $item->product_name,
                'product_slug' => $item->product?->slug,
                'thumbnail_url' => $item->product?->primaryImage?->thumbnailUrl(),
                'sku' => $item->sku,
                'variant_attributes' => $item->variant_attributes,
                'quantity' => (int) $item->quantity,
                'original_price' => (float) $item->original_price,
                'unit_price' => (float) $item->unit_price,
                'total_price' => (float) $item->total_price,
                'is_negotiated' => $item->negotiation_id !== null,
                'negotiation_id' => $item->negotiation_id,
                'reviewed' => $item->relationLoaded('review') ? $item->review !== null : null,
            ])),
            'address' => $this->whenLoaded('address', fn () => $this->address ? [
                'full_name' => $this->address->full_name,
                'phone' => $this->address->phone,
                'address_line1' => $this->address->address_line1,
                'address_line2' => $this->address->address_line2,
                'city' => $this->address->city,
                'region' => $this->address->region,
                'postal_code' => $this->address->postal_code,
                'country' => $this->address->country,
                'delivery_notes' => $this->address->delivery_notes,
            ] : null),
            'payment' => $this->whenLoaded('payment', fn () => $this->payment ? [
                'id' => $this->payment->id,
                'method' => $this->payment->payment_method->value,
                'method_label' => $this->payment->payment_method->label(),
                'status' => $this->payment->status->value,
                'status_label' => $this->payment->status->label(),
                'amount' => (float) $this->payment->amount,
                'collected_at' => $this->payment->collected_at?->toIso8601String(),
                'collected_by' => $this->payment->collected_by,
                'collector_name' => $this->payment->relationLoaded('collector') ? $this->payment->collector?->name : null,
            ] : null),
            'status_history' => $this->whenLoaded('statusHistory', fn () => $this->statusHistory->map(fn ($entry) => [
                'id' => $entry->id,
                'from_status' => $entry->from_status?->value,
                'to_status' => $entry->to_status->value,
                'to_status_label' => $entry->to_status->label(),
                'note' => $entry->note,
                'changed_by' => $entry->changed_by,
                'changed_by_name' => $entry->relationLoaded('changedBy') ? $entry->changedBy?->name : null,
                'created_at' => $entry->created_at?->toIso8601String(),
            ])),
            'confirmed_at' => $this->confirmed_at?->toIso8601String(),
            'shipped_at' => $this->shipped_at?->toIso8601String(),
            'delivered_at' => $this->delivered_at?->toIso8601String(),
            'received_at' => $this->received_at?->toIso8601String(),
            'cancelled_at' => $this->cancelled_at?->toIso8601String(),
            'cancellation_reason' => $this->cancellation_reason,
            'disputes' => DisputeResource::collection($this->whenLoaded('disputes')),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
