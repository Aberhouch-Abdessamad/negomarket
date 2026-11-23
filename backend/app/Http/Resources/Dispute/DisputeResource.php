<?php

namespace App\Http\Resources\Dispute;

use App\Models\Dispute;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Dispute */
class DisputeResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'order_id' => $this->order_id,
            'order_reference' => $this->whenLoaded('order', fn () => $this->order?->reference_number),
            'order' => $this->whenLoaded('order', fn () => $this->order ? [
                'id' => $this->order->id,
                'reference_number' => $this->order->reference_number,
                'status' => $this->order->status->value,
                'status_label' => $this->order->status->label(),
                'total_amount' => (float) $this->order->total_amount,
                'store' => $this->order->relationLoaded('store') && $this->order->store ? [
                    'id' => $this->order->store->id,
                    'name' => $this->order->store->name,
                    'slug' => $this->order->store->slug,
                ] : null,
            ] : null),
            'reason' => $this->reason,
            'reason_label' => ucfirst(str_replace('_', ' ', $this->reason)),
            'description' => $this->description,
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'resolution' => $this->resolution,
            'opened_by' => $this->whenLoaded('opener', fn () => [
                'id' => $this->opener->id,
                'name' => $this->opener->name,
            ]),
            'resolved_by' => $this->whenLoaded('resolver', fn () => $this->resolver ? [
                'id' => $this->resolver->id,
                'name' => $this->resolver->name,
            ] : null),
            'resolved_at' => $this->resolved_at?->toIso8601String(),
            'messages' => DisputeMessageResource::collection($this->whenLoaded('messages')),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
