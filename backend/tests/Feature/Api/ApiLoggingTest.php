<?php

namespace Tests\Feature\Api;

use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Log;
use Tests\TestCase;

/**
 * LOG_API_REQUESTS=true writes one line per API request to storage/logs/laravel.log,
 * and token issuance is always logged (never with the plain-text secret).
 */
class ApiLoggingTest extends TestCase
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

    public function test_api_requests_are_logged_when_enabled(): void
    {
        config(['api.log_requests' => true]);
        Log::spy();

        $this->getJson('/api/v1/health')->assertOk();

        Log::shouldHaveReceived('info')
            ->withArgs(fn (string $message, array $context = []) => $message === 'api.request'
                && $context['path'] === 'api/v1/health'
                && $context['method'] === 'GET'
                && $context['status'] === 200
                && $context['auth'] === 'guest'
                && $context['user_id'] === null
                && isset($context['duration_ms'], $context['ip']))
            ->once();
    }

    public function test_api_requests_are_not_logged_by_default(): void
    {
        config(['api.log_requests' => false]);
        Log::spy();

        $this->getJson('/api/v1/health')->assertOk();

        Log::shouldNotHaveReceived('info');
    }

    public function test_failed_requests_are_logged_too(): void
    {
        config(['api.log_requests' => true]);
        Log::spy();

        $this->getJson('/api/v1/cart')->assertUnauthorized();

        Log::shouldHaveReceived('info')
            ->withArgs(fn (string $message, array $context = []) => $message === 'api.request'
                && $context['path'] === 'api/v1/cart'
                && $context['status'] === 401
                && $context['auth'] === 'guest')
            ->once();
    }

    public function test_token_requests_are_logged_with_the_user_and_token_id(): void
    {
        config(['api.log_requests' => true]);
        $user = $this->customer(['email' => 'log@example.com']);

        $token = $this->postJson('/api/v1/auth/token', [
            'email' => 'log@example.com',
            'password' => 'password',
            'device_name' => 'postman',
        ])->assertOk()->json('data.token');

        $record = $user->tokens()->firstOrFail();

        Log::spy();
        $this->withHeader('Authorization', 'Bearer '.$token)->getJson('/api/v1/auth/me')->assertOk();

        Log::shouldHaveReceived('info')
            ->withArgs(fn (string $message, array $context = []) => $message === 'api.request'
                && $context['auth'] === 'token'
                && $context['token_id'] === $record->id
                && $context['user_id'] === $user->id)
            ->once();
    }

    public function test_token_issuance_is_logged_without_leaking_the_secret(): void
    {
        $user = $this->customer(['email' => 'log@example.com']);
        Log::spy();

        $token = $this->postJson('/api/v1/auth/token', [
            'email' => 'log@example.com',
            'password' => 'password',
            'device_name' => 'postman',
        ])->assertOk()->json('data.token');

        Log::shouldHaveReceived('info')
            ->withArgs(function (string $message, array $context = []) use ($user, $token) {
                return $message === 'api.token.issued'
                    && $context['user_id'] === $user->id
                    && $context['email'] === 'log@example.com'
                    && $context['token_name'] === 'postman'
                    && isset($context['token_id'])
                    // The plain-text token must never reach the log file.
                    && ! str_contains(json_encode($context), $token)
                    && ! isset($context['token']);
            })
            ->once();
    }

    public function test_rejected_token_logins_are_logged(): void
    {
        $this->customer(['email' => 'log@example.com']);
        Log::spy();

        $this->postJson('/api/v1/auth/token', ['email' => 'log@example.com', 'password' => 'wrong'])
            ->assertUnprocessable();

        Log::shouldHaveReceived('warning')
            ->withArgs(fn (string $message, array $context = []) => $message === 'api.token.rejected'
                && $context['reason'] === 'invalid_credentials')
            ->once();
    }

    public function test_artisan_token_command_logs_the_issuance(): void
    {
        $user = $this->customer(['email' => 'cli@example.com']);

        Log::spy();
        $this->artisan('api:token', ['email' => 'cli@example.com', '--name' => 'cli'])->assertSuccessful();

        Log::shouldHaveReceived('info')
            ->withArgs(fn (string $message, array $context = []) => $message === 'api.token.issued'
                && $context['source'] === 'artisan'
                && $context['user_id'] === $user->id)
            ->once();
    }
}
