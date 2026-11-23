<?php

namespace App\Models;

use App\Enums\ProductStatus;
use App\Enums\StoreStatus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class Product extends Model
{
    use HasFactory, SoftDeletes;

    /**
     * Not mass-assignable on purpose:
     *  - store_id (ownership comes from the authenticated seller)
     *  - stock_quantity (changed only through InventoryService + ledger)
     *  - status / featured / rejection_reason (moderation workflow)
     *  - slug, counters and ratings (derived)
     */
    /** Mirrors the database column defaults. */
    protected $attributes = ['status' => 'draft', 'stock_quantity' => 0, 'allow_negotiation' => false, 'featured' => false];

    protected $fillable = [
        'category_id', 'name', 'sku', 'description', 'price', 'minimum_price', 'allow_negotiation',
    ];

    /** The seller's minimum acceptable price is private and never serialised by default. */
    protected $hidden = ['minimum_price'];

    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
            'minimum_price' => 'decimal:2',
            'stock_quantity' => 'integer',
            'allow_negotiation' => 'boolean',
            'featured' => 'boolean',
            'status' => ProductStatus::class,
            'rating_avg' => 'decimal:2',
            'published_at' => 'datetime',
        ];
    }

    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function images(): HasMany
    {
        return $this->hasMany(ProductImage::class)->orderBy('sort_order');
    }

    public function primaryImage(): HasOne
    {
        return $this->hasOne(ProductImage::class)->orderBy('sort_order');
    }

    public function variants(): HasMany
    {
        return $this->hasMany(ProductVariant::class);
    }

    public function reviews(): HasMany
    {
        return $this->hasMany(ProductReview::class);
    }

    public function negotiations(): HasMany
    {
        return $this->hasMany(Negotiation::class);
    }

    public function inventoryMovements(): HasMany
    {
        return $this->hasMany(InventoryMovement::class);
    }

    public function orderItems(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    public function isPurchasable(): bool
    {
        return $this->status === ProductStatus::Published && $this->stock_quantity > 0;
    }

    /** Products visible in the public marketplace: published and from an active store. */
    public function scopeVisible(Builder $query): Builder
    {
        return $query->where('status', ProductStatus::Published)
            ->whereHas('store', fn (Builder $q) => $q->where('status', StoreStatus::Active));
    }
}
