<?php

namespace App\Http\Resources\Admin;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin User */
class UserAdminResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'phone' => $this->phone,
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'email_verified' => $this->email_verified_at !== null,
            'roles' => $this->relationLoaded('roles') ? $this->roles->pluck('name')->sort()->values() : [],
            'store' => $this->relationLoaded('store') && $this->store ? [
                'id' => $this->store->id,
                'name' => $this->store->name,
                'slug' => $this->store->slug,
                'status' => $this->store->status->value,
            ] : null,
            'orders_count' => $this->whenCounted('orders'),
            'reviews_count' => $this->whenCounted('reviews'),
            'negotiations_count' => $this->whenCounted('negotiations'),
            'last_seen_at' => $this->last_seen_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
