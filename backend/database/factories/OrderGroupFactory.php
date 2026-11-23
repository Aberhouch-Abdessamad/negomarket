<?php

namespace Database\Factories;

use App\Enums\OrderGroupStatus;
use App\Models\OrderGroup;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<OrderGroup>
 */
class OrderGroupFactory extends Factory
{
    protected $model = OrderGroup::class;

    public function definition(): array
    {
        $subtotal = fake()->randomFloat(2, 100, 3000);

        return [
            'customer_id' => User::factory(),
            'reference_number' => 'NM-'.now()->format('ymd').'-'.strtoupper(Str::random(6)),
            'idempotency_key' => (string) Str::uuid(),
            'payment_method' => 'cod',
            'subtotal' => $subtotal,
            'shipping_total' => 0,
            'discount_total' => 0,
            'total_amount' => $subtotal,
            'status' => OrderGroupStatus::Pending,
        ];
    }
}
