<?php

namespace Database\Factories;

use App\Enums\DisputeStatus;
use App\Models\Dispute;
use App\Models\Order;
use Database\Factories\Concerns\ResolvesModels;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Dispute>
 */
class DisputeFactory extends Factory
{
    use ResolvesModels;

    protected $model = Dispute::class;

    public function definition(): array
    {
        return [
            'order_id' => Order::factory(),
            'opened_by' => fn (array $attributes) => self::resolve(Order::class, $attributes['order_id'])->customer_id,
            'reason' => fake()->randomElement(['item_not_received', 'item_damaged', 'wrong_item', 'other']),
            'description' => fake()->paragraph(),
            'status' => DisputeStatus::Open,
        ];
    }
}
