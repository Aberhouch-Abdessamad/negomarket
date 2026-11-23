<?php

namespace App\Http\Resources\Seller;

use App\Models\Store;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

/** The owner's view of their store (includes private contact details and addresses). @mixin Store */
class SellerStoreResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'description' => $this->description,
            'logo_url' => $this->logo ? Storage::disk('public')->url($this->logo) : null,
            'banner_url' => $this->banner ? Storage::disk('public')->url($this->banner) : null,
            'phone' => $this->phone,
            'email' => $this->email,
            'address' => $this->address,
            'city' => $this->city,
            'status' => $this->status->value,
            'rating_avg' => (float) $this->rating_avg,
            'rating_count' => (int) $this->rating_count,
            'approved_at' => $this->approved_at?->toIso8601String(),
            'addresses' => StoreAddressResource::collection($this->whenLoaded('addresses')),
        ];
    }
}
