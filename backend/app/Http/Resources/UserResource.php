<?php

namespace App\Http\Resources;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

/**
 * The authenticated user's own profile (GET /auth/me). Includes roles,
 * permissions and seller state so the SPA can render the right navigation;
 * the backend still re-checks authorization on every request.
 *
 * Call $user->loadAuthContext() before wrapping.
 *
 * @mixin User
 */
class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $store = $this->relationLoaded('store') ? $this->store : null;
        $application = $this->relationLoaded('latestStoreApplication') ? $this->latestStoreApplication : null;
        $withRoles = $this->relationLoaded('roles');

        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'phone' => $this->phone,
            'avatar_url' => $this->avatar_path ? Storage::disk('public')->url($this->avatar_path) : null,
            'status' => $this->status->value,
            'email_verified' => $this->email_verified_at !== null,
            'roles' => $this->when($withRoles, fn () => $this->roles->pluck('name')->sort()->values()),
            'permissions' => $this->when($withRoles, fn () => $this->getAllPermissions()->pluck('name')->sort()->values()),
            'is_admin' => $this->when($withRoles, fn () => $this->hasRole('admin')),
            'is_seller' => $this->when($withRoles, fn () => $this->isApprovedSeller()),
            'store' => $store ? [
                'id' => $store->id,
                'name' => $store->name,
                'slug' => $store->slug,
                'status' => $store->status->value,
            ] : null,
            'seller_application' => $application ? [
                'id' => $application->id,
                'status' => $application->status->value,
                'submitted_at' => $application->created_at->toIso8601String(),
            ] : null,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
