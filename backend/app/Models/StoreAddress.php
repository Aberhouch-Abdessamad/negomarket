<?php

namespace App\Models;

use App\Enums\StoreAddressType;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StoreAddress extends Model
{
    use HasFactory;

    protected $fillable = [
        'type', 'label', 'contact_name', 'phone', 'address_line1', 'address_line2',
        'city', 'region', 'postal_code', 'country', 'is_default',
    ];

    protected function casts(): array
    {
        return ['type' => StoreAddressType::class, 'is_default' => 'boolean'];
    }

    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
    }
}
