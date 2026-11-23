<?php

namespace App\Http\Resources\Marketplace;

use App\Models\Category;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

/** @mixin Category */
class CategoryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'description' => $this->description,
            'image_url' => $this->image ? Storage::disk('public')->url($this->image) : null,
            'parent_id' => $this->parent_id,
            'products_count' => $this->whenHas('products_count', fn () => (int) $this->products_count),
            'children' => self::collection($this->whenLoaded('children')),
        ];
    }
}
