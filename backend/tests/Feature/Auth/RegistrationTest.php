<?php

namespace Tests\Feature\Auth;

use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\Concerns\ActsAsSpa;
use Tests\TestCase;

class RegistrationTest extends TestCase
{
    use ActsAsSpa, RefreshDatabase;

    private function payload(array $overrides = []): array
    {
        return array_merge([
            'name' => 'Salma Bennani',
            'email' => 'Salma@Example.com',
            'phone' => '0612345678',
            'password' => 'secret123',
            'password_confirmation' => 'secret123',
            'accept_terms' => true,
        ], $overrides);
    }

    public function test_user_can_register_as_customer_and_is_signed_in(): void
    {
        Notification::fake();

        $response = $this->postJson('/api/v1/auth/register', $this->payload())
            ->assertCreated()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.email', 'salma@example.com')
            ->assertJsonPath('data.roles', ['customer'])
            ->assertJsonPath('data.is_seller', false)
            ->assertJsonPath('data.email_verified', true)
            ->assertJsonMissingPath('data.password');

        $user = User::where('email', 'salma@example.com')->firstOrFail();
        $this->assertTrue($user->hasRole('customer'));
        $this->assertAuthenticatedAs($user, 'web');
        $this->assertNotNull($user->email_verified_at);
        Notification::assertNothingSent();
        $this->assertDatabaseHas(ActivityLog::class, ['action' => 'auth.registered', 'user_id' => $user->id]);
        $this->assertNotEquals('secret123', $user->password);

        $this->getJson('/api/v1/auth/me')->assertOk()->assertJsonPath('data.id', $user->id);
        $response->assertJsonStructure(['data' => ['id', 'name', 'email', 'roles', 'permissions', 'store', 'seller_application']]);
    }

    public function test_registration_validates_input(): void
    {
        User::factory()->create(['email' => 'taken@example.com']);

        $this->postJson('/api/v1/auth/register', $this->payload([
            'name' => '',
            'email' => 'TAKEN@example.com',
            'password' => 'short',
            'password_confirmation' => 'different',
            'accept_terms' => false,
        ]))->assertUnprocessable()
            ->assertJsonValidationErrors(['name', 'email', 'password', 'accept_terms'])
            ->assertJsonPath('success', false);

        $this->postJson('/api/v1/auth/register', $this->payload(['password' => 'onlyletters', 'password_confirmation' => 'onlyletters']))
            ->assertJsonValidationErrors(['password']);
    }

    public function test_client_cannot_choose_roles_or_status_at_registration(): void
    {
        $this->postJson('/api/v1/auth/register', $this->payload([
            'roles' => ['admin'], 'status' => 'active', 'email_verified_at' => now(), 'is_admin' => true,
        ]))->assertCreated()->assertJsonPath('data.roles', ['customer'])->assertJsonPath('data.email_verified', true);
    }
}
