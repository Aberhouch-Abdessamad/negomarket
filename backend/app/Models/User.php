<?php

namespace App\Models;

use App\Enums\StoreStatus;
use App\Enums\UserStatus;
use App\Notifications\Auth\ResetPasswordNotification;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

/**
 * One account for every role: a customer becomes a seller (same account)
 * once their store application is approved.
 */
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, HasRoles, Notifiable;

    /** status, roles and verification are never mass-assigned. */
    /** Mirrors the database column defaults. */
    protected $attributes = ['status' => 'active'];

    protected $fillable = ['name', 'email', 'password', 'phone', 'avatar_path'];

    protected $hidden = ['password', 'remember_token'];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'last_seen_at' => 'datetime',
            'password' => 'hashed',
            'status' => UserStatus::class,
        ];
    }

    public function addresses(): HasMany
    {
        return $this->hasMany(UserAddress::class);
    }

    public function defaultAddress(): HasOne
    {
        return $this->hasOne(UserAddress::class)->where('is_default', true);
    }

    public function storeApplications(): HasMany
    {
        return $this->hasMany(StoreApplication::class);
    }

    public function latestStoreApplication(): HasOne
    {
        return $this->hasOne(StoreApplication::class)->latestOfMany();
    }

    public function store(): HasOne
    {
        return $this->hasOne(Store::class);
    }

    public function storeProducts(): HasManyThrough
    {
        return $this->hasManyThrough(Product::class, Store::class);
    }

    public function wishlist(): HasOne
    {
        return $this->hasOne(Wishlist::class);
    }

    public function cart(): HasOne
    {
        return $this->hasOne(Cart::class);
    }

    public function negotiations(): HasMany
    {
        return $this->hasMany(Negotiation::class, 'customer_id');
    }

    public function orderGroups(): HasMany
    {
        return $this->hasMany(OrderGroup::class, 'customer_id');
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class, 'customer_id');
    }

    public function reviews(): HasMany
    {
        return $this->hasMany(ProductReview::class);
    }

    public function activityLogs(): HasMany
    {
        return $this->hasMany(ActivityLog::class);
    }

    /** Database notifications are mirrored on private-users.{id} for realtime UI updates. */
    public function receivesBroadcastNotificationsOn(): string
    {
        return 'users.'.$this->id;
    }

    /** Relations needed to build the UserResource for the SPA. */
    public function loadAuthContext(): static
    {
        return $this->load(['roles.permissions', 'permissions', 'store', 'latestStoreApplication']);
    }

    public function sendPasswordResetNotification(#[\SensitiveParameter] $token): void
    {
        $this->notify(new ResetPasswordNotification($token));
    }

    public function isActive(): bool
    {
        return $this->status === UserStatus::Active;
    }

    public function avatarUrl(): ?string
    {
        return $this->avatar_path ? Storage::disk('public')->url($this->avatar_path) : null;
    }

    public function isAdmin(): bool
    {
        return $this->hasRole('admin');
    }

    /** Seller access requires the seller role AND an active (approved) store. */
    public function isApprovedSeller(): bool
    {
        return $this->hasRole('seller') && $this->store?->status === StoreStatus::Active;
    }
}
