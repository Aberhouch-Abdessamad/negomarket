<?php

namespace Database\Factories;

use App\Models\Order;
use App\Models\OrderAddress;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<OrderAddress>
 */
class OrderAddressFactory extends Factory
{
    protected $model = OrderAddress::class;

    public function definition(): array
    {
        return [
            'order_id' => Order::factory(),
            'full_name' => fake()->name(),
            'phone' => fake()->numerify('06########'),
            'address_line1' => fake()->streetAddress(),
            'city' => fake()->randomElement(['Casablanca', 'Rabat', 'Marrakesh']),
            'country' => 'MA',
            'delivery_notes' => fake()->optional()->sentence(),
        ];
    }
}
