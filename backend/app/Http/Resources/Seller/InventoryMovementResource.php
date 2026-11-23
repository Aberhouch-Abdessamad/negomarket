<?php

namespace App\Http\Resources\Seller;

use App\Models\InventoryMovement;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin InventoryMovement */
class InventoryMovementResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'type' => $this->type->value,
            'quantity_change' => $this->quantity_change,
            'quantity_before' => $this->quantity_before,
            'quantity_after' => $this->quantity_after,
            'product' => $this->whenLoaded('product', fn () => ['id' => $this->product->id, 'name' => $this->product->name, 'sku' => $this->product->sku]),
            'variant' => $this->whenLoaded('variant', fn () => $this->variant ? ['id' => $this->variant->id, 'sku' => $this->variant->sku, 'attributes' => $this->variant->getAttribute('attributes')] : null),
            'reference' => $this->reference_type ? ['type' => class_basename($this->reference_type), 'id' => $this->reference_id] : null,
            'actor' => $this->whenLoaded('user', fn () => $this->user?->name),
            'note' => $this->note,
            'created_at' => $this->created_at->toIso8601String(),
        ];
    }
}
