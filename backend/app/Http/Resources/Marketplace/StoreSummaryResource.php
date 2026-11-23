<?php

namespace App\Http\Resources\Marketplace;

use App\Models\Store;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

/** @mixin Store */
class StoreSummaryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'logo_url' => $this->logo ? Storage::disk('public')->url($this->logo) : null,
            'city' => $this->city,
            'rating_avg' => (float) $this->rating_avg,
            'rating_count' => (int) $this->rating_count,
        ];
    }
}
