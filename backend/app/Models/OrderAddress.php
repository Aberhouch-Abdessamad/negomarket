<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Immutable delivery-address snapshot taken at checkout. */
class OrderAddress extends Model
{
    use HasFactory;

    protected $fillable = [
        'full_name', 'phone', 'address_line1', 'address_line2', 'city',
        'region', 'postal_code', 'country', 'delivery_notes',
    ];

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }
}
