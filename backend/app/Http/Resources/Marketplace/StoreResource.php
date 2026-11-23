<?php

namespace App\Http\Resources\Marketplace;

use App\Models\Store;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

/** Public store profile. Owner identity and private contact data are not exposed. @mixin Store */
class StoreResource extends JsonResource
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
            'city' => $this->city,
            'rating_avg' => (float) $this->rating_avg,
            'rating_count' => (int) $this->rating_count,
            'products_count' => (int) ($this->visible_products_count ?? 0),
            'negotiable_products_count' => $this->whenHas('negotiable_products_count', fn () => (int) $this->negotiable_products_count),
            'member_since' => $this->approved_at?->toDateString() ?? $this->created_at->toDateString(),
        ];
    }
}
