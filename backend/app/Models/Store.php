<?php

namespace App\Models;

use App\Enums\StoreStatus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;
use Illuminate\Database\Eloquent\SoftDeletes;

class Store extends Model
{
    use HasFactory, SoftDeletes;

    /** user_id, slug, status, ratings and approval are never mass-assigned. */
    /** Mirrors the database column defaults. */
    protected $attributes = ['status' => 'pending'];

    protected $fillable = ['name', 'description', 'logo', 'banner', 'phone', 'email', 'address', 'city'];

    protected function casts(): array
    {
        return [
            'status' => StoreStatus::class,
            'rating_avg' => 'decimal:2',
            'approved_at' => 'datetime',
        ];
    }

    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function application(): BelongsTo
    {
        return $this->belongsTo(StoreApplication::class, 'store_application_id');
    }

    public function addresses(): HasMany
    {
        return $this->hasMany(StoreAddress::class);
    }

    public function products(): HasMany
    {
        return $this->hasMany(Product::class);
    }

    public function negotiations(): HasMany
    {
        return $this->hasMany(Negotiation::class);
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }

    public function reviews(): HasManyThrough
    {
        return $this->hasManyThrough(ProductReview::class, Product::class);
    }

    public function isActive(): bool
    {
        return $this->status === StoreStatus::Active;
    }

    public function logoUrl(): ?string
    {
        return $this->logo ? \Illuminate\Support\Facades\Storage::disk('public')->url($this->logo) : null;
    }

    public function bannerUrl(): ?string
    {
        return $this->banner ? \Illuminate\Support\Facades\Storage::disk('public')->url($this->banner) : null;
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('status', StoreStatus::Active);
    }
}
