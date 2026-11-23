<?php

namespace Tests\Feature\Auth;

use App\Enums\UserStatus;
use App\Models\ActivityLog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\RateLimiter;
use Tests\Concerns\ActsAsSpa;
use Tests\TestCase;

class LoginTest extends TestCase
{
    use ActsAsSpa, RefreshDatabase;

    public function test_user_can_log_in_and_receive_their_profile(): void
    {
        $user = $this->customer(['email' => 'amine@example.com']);

        $this->postJson('/api/v1/auth/login', ['email' => ' AMINE@example.com ', 'password' => 'password'])
            ->assertOk()
            ->assertJsonPath('data.id', $user->id)
            ->assertJsonPath('data.roles', ['customer'])
            ->assertJsonPath('message', 'Signed in.');

        $this->assertAuthenticatedAs($user, 'web');
        $this->assertNotNull($user->fresh()->last_seen_at);
        $this->assertDatabaseHas(ActivityLog::class, ['action' => 'auth.login', 'user_id' => $user->id]);
    }

    public function test_wrong_credentials_return_generic_error(): void
    {
        $this->customer(['email' => 'amine@example.com']);

        $this->postJson('/api/v1/auth/login', ['email' => 'amine@example.com', 'password' => 'wrong'])
            ->assertUnprocessable()
            ->assertJsonPath('errors.email.0', __('auth.failed'));
        $this->postJson('/api/v1/auth/login', ['email' => 'nobody@example.com', 'password' => 'wrong'])
            ->assertUnprocessable()
            ->assertJsonPath('errors.email.0', __('auth.failed'));

        $this->assertGuest('web');
        $this->assertDatabaseHas(ActivityLog::class, ['action' => 'auth.login_failed']);
    }

    public function test_suspended_users_cannot_log_in(): void
    {
        $user = $this->customer();
        $user->forceFill(['status' => UserStatus::Suspended])->save();

        $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'password'])
            ->assertForbidden()
            ->assertJsonPath('message', 'Your account has been suspended. Please contact support.');
        $this->assertGuest('web');
    }

    public function test_suspended_user_with_existing_session_is_signed_out(): void
    {
        $user = $this->customer();
        $this->actingAs($user, 'web');
        $user->forceFill(['status' => UserStatus::Suspended])->save();

        $this->getJson('/api/v1/auth/me')->assertForbidden();
    }

    public function test_login_is_rate_limited(): void
    {
        $user = $this->customer();
        RateLimiter::clear('auth-email:'.$user->email.'|127.0.0.1');

        for ($i = 0; $i < 10; $i++) {
            $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'wrong'])->assertUnprocessable();
        }

        $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'password'])
            ->assertStatus(429)
            ->assertJsonPath('success', false);
    }

    public function test_user_can_log_out(): void
    {
        $user = $this->customer();
        $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'password'])->assertOk();

        $this->postJson('/api/v1/auth/logout')->assertOk()->assertJsonPath('message', 'Signed out.');
        $this->assertGuest('web');
        $this->assertDatabaseHas(ActivityLog::class, ['action' => 'auth.logout', 'user_id' => $user->id]);
    }

    public function test_guests_cannot_access_protected_endpoints(): void
    {
        foreach ([['get', '/api/v1/auth/me'], ['post', '/api/v1/auth/logout'], ['put', '/api/v1/profile'], ['get', '/api/v1/profile/addresses']] as [$method, $uri]) {
            $this->json($method, $uri)->assertUnauthorized()->assertJsonPath('message', 'Unauthenticated.');
        }
    }
}
