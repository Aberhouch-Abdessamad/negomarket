<?php

namespace App\Models;

use App\Enums\VariantStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class ProductVariant extends Model
{
    use HasFactory, SoftDeletes;

    /** stock_quantity is changed only through InventoryService. */
    /** Mirrors the database column defaults. */
    protected $attributes = ['status' => 'active', 'stock_quantity' => 0];

    protected $fillable = ['sku', 'attributes', 'price', 'status'];

    protected function casts(): array
    {
        return [
            'attributes' => 'array',
            'price' => 'decimal:2',
            'stock_quantity' => 'integer',
            'status' => VariantStatus::class,
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    /** Variant price, falling back to the parent product price. */
    public function effectivePrice(): string
    {
        return $this->price ?? $this->product->price;
    }
}
