<?php

namespace Database\Factories;

use App\Enums\StoreAddressType;
use App\Models\Store;
use App\Models\StoreAddress;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<StoreAddress>
 */
class StoreAddressFactory extends Factory
{
    protected $model = StoreAddress::class;

    public function definition(): array
    {
        return [
            'store_id' => Store::factory(),
            'type' => StoreAddressType::Business,
            'label' => 'Head office',
            'contact_name' => fake()->name(),
            'phone' => fake()->numerify('05########'),
            'address_line1' => fake()->streetAddress(),
            'city' => fake()->randomElement(['Casablanca', 'Rabat', 'Marrakesh']),
            'postal_code' => fake()->numerify('#####'),
            'country' => 'MA',
            'is_default' => true,
        ];
    }

    public function pickup(): static
    {
        return $this->state(['type' => StoreAddressType::Pickup, 'label' => 'Warehouse']);
    }
}
