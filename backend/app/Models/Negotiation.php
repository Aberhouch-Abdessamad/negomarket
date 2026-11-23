<?php

namespace App\Models;

use App\Enums\NegotiationStatus;
use App\Enums\OfferStatus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * All state changes go through NegotiationService (Phase 6); nothing here is mass-assignable.
 */
class Negotiation extends Model
{
    use HasFactory;

    /** Mirrors the database column defaults. */
    protected $attributes = ['status' => 'active', 'quantity' => 1];

    protected $fillable = [];

    protected $hidden = ['active_key'];

    protected function casts(): array
    {
        return [
            'status' => NegotiationStatus::class,
            'quantity' => 'integer',
            'expires_at' => 'datetime',
            'last_activity_at' => 'datetime',
            'closed_at' => 'datetime',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class)->withTrashed();
    }

    public function variant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class, 'product_variant_id')->withTrashed();
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'customer_id');
    }

    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class)->withTrashed();
    }

    public function offers(): HasMany
    {
        return $this->hasMany(NegotiationOffer::class)->orderBy('id');
    }

    public function latestOffer(): HasOne
    {
        return $this->hasOne(NegotiationOffer::class)->latestOfMany();
    }

    public function pendingOffer(): HasOne
    {
        return $this->hasOne(NegotiationOffer::class)->where('status', OfferStatus::Pending);
    }

    public function acceptedOffer(): BelongsTo
    {
        return $this->belongsTo(NegotiationOffer::class, 'accepted_offer_id');
    }

    public function messages(): HasMany
    {
        return $this->hasMany(Message::class)->orderBy('id');
    }

    public function convertedOrder(): BelongsTo
    {
        return $this->belongsTo(Order::class, 'converted_order_id');
    }

    public function orderItem(): HasOne
    {
        return $this->hasOne(OrderItem::class);
    }

    /** True if the user is the customer or the owner of the store. */
    public function isParticipant(User $user): bool
    {
        if ($user->id === $this->customer_id) {
            return true;
        }

        $this->loadMissing('store');

        return $user->id === $this->store?->user_id;
    }

    public function scopeForParticipant(Builder $query, User $user): Builder
    {
        return $query->where(fn (Builder $q) => $q
            ->where('customer_id', $user->id)
            ->orWhereHas('store', fn (Builder $s) => $s->where('user_id', $user->id)));
    }
}
