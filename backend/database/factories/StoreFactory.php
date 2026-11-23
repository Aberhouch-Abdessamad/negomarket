<?php

namespace Database\Factories;

use App\Enums\StoreStatus;
use App\Models\Store;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Store>
 */
class StoreFactory extends Factory
{
    protected $model = Store::class;

    public function definition(): array
    {
        $name = fake()->unique()->company();

        return [
            'user_id' => User::factory(),
            'name' => $name,
            'slug' => Str::slug($name).'-'.Str::lower(Str::random(4)),
            'description' => fake()->paragraph(),
            'phone' => fake()->numerify('05########'),
            'email' => fake()->companyEmail(),
            'address' => fake()->streetAddress(),
            'city' => fake()->randomElement(['Casablanca', 'Rabat', 'Marrakesh', 'Fes', 'Tangier']),
            'status' => StoreStatus::Pending,
        ];
    }

    public function active(): static
    {
        return $this->state(['status' => StoreStatus::Active, 'approved_at' => now()]);
    }

    public function suspended(): static
    {
        return $this->state(['status' => StoreStatus::Suspended]);
    }
}
