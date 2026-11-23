<?php

namespace Tests\Concerns;

use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;

/**
 * Makes test requests look like they come from the React SPA so Sanctum
 * treats them as stateful (session + CSRF-cookie based).
 */
trait ActsAsSpa
{
    protected function setUpActsAsSpa(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->withHeaders([
            'Origin' => 'http://localhost:5173',
            'Referer' => 'http://localhost:5173/',
            'Accept' => 'application/json',
        ]);
    }

    protected function customer(array $attributes = []): User
    {
        return tap(User::factory()->create($attributes))->assignRole('customer');
    }
}
