<?php

namespace App\Models;

use App\Enums\StoreApplicationStatus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class StoreApplication extends Model
{
    use HasFactory;

    /** status / reviewer fields are set by the admin review workflow only. */
    /** Mirrors the database column defaults. */
    protected $attributes = ['status' => 'pending'];

    protected $fillable = ['business_name', 'description', 'contact_phone', 'address', 'city'];

    protected $hidden = ['pending_key'];

    protected function casts(): array
    {
        return [
            'status' => StoreApplicationStatus::class,
            'reviewed_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function store(): HasOne
    {
        return $this->hasOne(Store::class);
    }

    public function scopePending(Builder $query): Builder
    {
        return $query->where('status', StoreApplicationStatus::Pending);
    }
}
