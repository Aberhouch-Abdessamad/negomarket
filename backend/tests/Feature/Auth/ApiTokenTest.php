<?php

namespace Tests\Feature\Auth;

use App\Enums\UserStatus;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Symfony\Component\HttpFoundation\Response;
use Tests\TestCase;

/**
 * POST /auth/token issues a Sanctum bearer token so non-browser clients
 * (curl, Postman, mobile) can call every protected API endpoint without the
 * SPA cookie/CSRF handshake.
 */
class ApiTokenTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolesAndPermissionsSeeder::class);
    }

    private function customer(array $attributes = []): User
    {
        return tap(User::factory()->create($attributes))->assignRole('customer');
    }

    public function test_token_login_returns_a_working_bearer_token(): void
    {
        $user = $this->customer(['email' => 'amine@example.com']);

        $response = $this->postJson('/api/v1/auth/token', [
            'email' => ' AMINE@example.com ',
            'password' => 'password',
            'device_name' => 'postman',
        ])->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('message', 'Token issued.')
            ->assertJsonPath('data.token_type', 'Bearer')
            ->assertJsonPath('data.user.id', $user->id)
            ->assertJsonPath('data.user.roles', ['customer']);

        $token = $response->json('data.token');

        $this->assertIsString($token);
        $this->assertDatabaseHas('personal_access_tokens', [
            'tokenable_id' => $user->id,
            'name' => 'postman',
        ]);
        // No session is created: clients authenticate with the header alone.
        $this->assertGuest('web');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/v1/auth/me')
            ->assertOk()
            ->assertJsonPath('data.id', $user->id);

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/v1/cart')
            ->assertOk();
    }

    public function test_token_login_uses_a_generic_error_for_bad_credentials(): void
    {
        $user = $this->customer();

        $this->postJson('/api/v1/auth/token', ['email' => $user->email, 'password' => 'wrong'])
            ->assertUnprocessable()
            ->assertJsonPath('errors.email.0', __('auth.failed'));

        $this->postJson('/api/v1/auth/token', ['email' => 'nobody@example.com', 'password' => 'wrong'])
            ->assertUnprocessable()
            ->assertJsonPath('errors.email.0', __('auth.failed'));

        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_suspended_users_cannot_get_a_token(): void
    {
        $user = $this->customer();
        $user->forceFill(['status' => UserStatus::Suspended])->save();

        $this->postJson('/api/v1/auth/token', ['email' => $user->email, 'password' => 'password'])
            ->assertForbidden()
            ->assertJsonPath('message', 'Your account has been suspended. Please contact support.');

        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_token_login_validates_the_request(): void
    {
        $this->postJson('/api/v1/auth/token', ['email' => 'not-an-email'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['email', 'password']);
    }

    public function test_revoked_token_no_longer_authenticates(): void
    {
        $user = $this->customer();

        $token = $this->postJson('/api/v1/auth/token', [
            'email' => $user->email,
            'password' => 'password',
        ])->json('data.token');

        $user->tokens()->delete();

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/v1/auth/me')
            ->assertStatus(Response::HTTP_UNAUTHORIZED)
            ->assertJsonPath('message', 'Unauthenticated.');
    }

    public function test_a_token_granted_to_a_suspended_user_stops_working(): void
    {
        $user = $this->customer();

        $token = $this->postJson('/api/v1/auth/token', [
            'email' => $user->email,
            'password' => 'password',
        ])->json('data.token');

        $user->forceFill(['status' => UserStatus::Suspended])->save();

        // The "active" middleware blocks suspended accounts on every token request.
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/v1/auth/me')
            ->assertForbidden();
    }

    public function test_tokens_carry_the_users_permissions(): void
    {
        $user = $this->customer();
        $user->assignRole('admin');

        $token = $this->postJson('/api/v1/auth/token', [
            'email' => $user->email,
            'password' => 'password',
        ])->json('data.token');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/v1/admin/dashboard')
            ->assertOk();

        $this->assertTrue($user->hasPermissionTo('users.manage'));
    }

    public function test_artisan_command_issues_a_token(): void
    {
        $user = $this->customer(['email' => 'cli@example.com']);

        $this->artisan('api:token', ['email' => 'cli@example.com', '--name' => 'cli'])
            ->expectsOutputToContain('Bearer token')
            ->assertSuccessful();

        $this->assertDatabaseHas('personal_access_tokens', [
            'tokenable_id' => $user->id,
            'name' => 'cli',
        ]);
    }
}
