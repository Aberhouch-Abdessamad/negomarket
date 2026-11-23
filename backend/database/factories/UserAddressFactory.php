<?php

namespace Database\Factories;

use App\Models\User;
use App\Models\UserAddress;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<UserAddress>
 */
class UserAddressFactory extends Factory
{
    protected $model = UserAddress::class;

    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'label' => fake()->randomElement(['Home', 'Work', null]),
            'full_name' => fake()->name(),
            'phone' => fake()->numerify('06########'),
            'address_line1' => fake()->streetAddress(),
            'address_line2' => null,
            'city' => fake()->randomElement(['Casablanca', 'Rabat', 'Marrakesh', 'Fes', 'Tangier', 'Agadir']),
            'region' => null,
            'postal_code' => fake()->numerify('#####'),
            'country' => 'MA',
            'is_default' => false,
        ];
    }

    public function default(): static
    {
        return $this->state(['is_default' => true]);
    }
}
