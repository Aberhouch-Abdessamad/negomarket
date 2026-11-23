<?php

namespace Database\Factories;

use App\Enums\InventoryMovementType;
use App\Models\InventoryMovement;
use App\Models\Product;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<InventoryMovement>
 */
class InventoryMovementFactory extends Factory
{
    protected $model = InventoryMovement::class;

    public function definition(): array
    {
        return [
            'product_id' => Product::factory(),
            'type' => InventoryMovementType::Initial,
            'quantity_change' => 10,
            'quantity_before' => 0,
            'quantity_after' => 10,
            'note' => 'Initial stock',
        ];
    }
}
