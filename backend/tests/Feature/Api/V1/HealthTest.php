<?php

namespace Tests\Feature\Api\V1;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class HealthTest extends TestCase
{
    use RefreshDatabase;

    public function test_health_endpoint_reports_ok_with_database_check(): void
    {
        $this->getJson('/api/v1/health')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.status', 'ok')
            ->assertJsonPath('data.api_version', 'v1')
            ->assertJsonPath('data.checks.database.ok', true)
            ->assertJsonStructure([
                'success', 'message',
                'data' => ['status', 'app', 'api_version', 'environment', 'server_time', 'checks' => ['database' => ['ok', 'latency_ms']]],
            ]);
    }

    public function test_health_endpoint_does_not_leak_configuration(): void
    {
        $body = $this->getJson('/api/v1/health')->getContent();

        $this->assertStringNotContainsString((string) config('app.key'), $body);
        $this->assertStringNotContainsString((string) config('database.connections.mysql.password') ?: '__no_password__', $body);
    }

    public function test_unknown_api_route_returns_json_404_envelope(): void
    {
        $this->getJson('/api/v1/does-not-exist')
            ->assertNotFound()
            ->assertExactJson(['success' => false, 'message' => 'Resource not found.']);
    }

    public function test_protected_route_requires_authentication(): void
    {
        $this->getJson('/api/v1/auth/me')
            ->assertUnauthorized()
            ->assertJsonPath('success', false)
            ->assertJsonPath('message', 'Unauthenticated.');
    }

    public function test_protected_route_accepts_sanctum_user(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/v1/auth/me')
            ->assertOk()
            ->assertJsonPath('data.id', $user->id);
    }

    public function test_cors_allows_the_configured_frontend_origin_with_credentials(): void
    {
        $this->withHeaders([
            'Origin' => 'http://localhost:5173',
            'Access-Control-Request-Method' => 'GET',
        ])->options('/api/v1/health')
            ->assertHeader('Access-Control-Allow-Origin', 'http://localhost:5173')
            ->assertHeader('Access-Control-Allow-Credentials', 'true');
    }

    public function test_csrf_cookie_endpoint_is_available_for_the_spa(): void
    {
        $this->get('/sanctum/csrf-cookie')->assertNoContent()->assertCookie('XSRF-TOKEN');
    }
}
