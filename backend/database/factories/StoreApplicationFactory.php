<?php

namespace Database\Factories;

use App\Enums\StoreApplicationStatus;
use App\Models\StoreApplication;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<StoreApplication>
 */
class StoreApplicationFactory extends Factory
{
    protected $model = StoreApplication::class;

    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'business_name' => fake()->company(),
            'description' => fake()->paragraph(),
            'contact_phone' => fake()->numerify('06########'),
            'address' => fake()->streetAddress(),
            'city' => fake()->randomElement(['Casablanca', 'Rabat', 'Marrakesh', 'Fes', 'Tangier']),
            'status' => StoreApplicationStatus::Pending,
        ];
    }

    public function approved(?User $reviewer = null): static
    {
        return $this->state(fn () => [
            'status' => StoreApplicationStatus::Approved,
            'reviewed_by' => $reviewer?->id ?? User::factory(),
            'reviewed_at' => now(),
        ]);
    }

    public function rejected(string $notes = 'Incomplete business information.'): static
    {
        return $this->state(fn () => [
            'status' => StoreApplicationStatus::Rejected,
            'admin_notes' => $notes,
            'reviewed_by' => User::factory(),
            'reviewed_at' => now(),
        ]);
    }
}
