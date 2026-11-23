<?php

namespace App\Models;

use App\Enums\OfferSenderRole;
use App\Enums\OfferStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Append-only: an offer is never overwritten; counter-offers are new rows. */
class NegotiationOffer extends Model
{
    use HasFactory;

    /** Mirrors the database column defaults. */
    protected $attributes = ['status' => 'pending'];

    protected $fillable = [];

    protected $hidden = ['pending_key', 'accepted_key'];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'status' => OfferStatus::class,
            'sender_role' => OfferSenderRole::class,
            'expires_at' => 'datetime',
            'responded_at' => 'datetime',
        ];
    }

    public function negotiation(): BelongsTo
    {
        return $this->belongsTo(Negotiation::class);
    }

    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sender_id');
    }

    public function responder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'responded_by');
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_offer_id');
    }

    public function counters(): HasMany
    {
        return $this->hasMany(self::class, 'parent_offer_id');
    }

    public function isExpired(): bool
    {
        return $this->expires_at->isPast();
    }
}
