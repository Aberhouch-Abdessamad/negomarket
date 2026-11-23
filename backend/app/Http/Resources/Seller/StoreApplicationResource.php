<?php

namespace App\Http\Resources\Seller;

use App\Models\StoreApplication;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin StoreApplication */
class StoreApplicationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $admin = $request->user()?->hasRole('admin');

        return [
            'id' => $this->id,
            'business_name' => $this->business_name,
            'description' => $this->description,
            'contact_phone' => $this->contact_phone,
            'address' => $this->address,
            'city' => $this->city,
            'status' => $this->status->value,
            'admin_notes' => $this->admin_notes,
            'reviewed_at' => $this->reviewed_at?->toIso8601String(),
            'created_at' => $this->created_at->toIso8601String(),
            'applicant' => $this->when($admin, fn () => $this->whenLoaded('user', fn () => [
                'id' => $this->user->id, 'name' => $this->user->name, 'email' => $this->user->email,
                'email_verified' => $this->user->email_verified_at !== null, 'member_since' => $this->user->created_at->toDateString(),
            ])),
            'reviewer' => $this->when($admin, fn () => $this->whenLoaded('reviewer', fn () => $this->reviewer?->name)),
            'store' => $this->whenLoaded('store', fn () => $this->store ? ['id' => $this->store->id, 'slug' => $this->store->slug, 'status' => $this->store->status->value] : null),
        ];
    }
}
