<?php

namespace Tests\Feature\Auth;

use App\Http\Responses\ApiResponse;
use App\Models\Store;
use App\Models\StoreApplication;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;
use Tests\Concerns\ActsAsSpa;
use Tests\TestCase;

/**
 * Verifies the role/permission middleware stack that later phases put on
 * /seller/* and /admin/* routes, using throw-away test routes.
 */
class RoleAccessTest extends TestCase
{
    use ActsAsSpa, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Route::middleware(['api', 'auth:sanctum', 'active', 'seller.approved'])
            ->get('/api/test/seller-area', fn () => ApiResponse::success('seller ok'));
        Route::middleware(['api', 'auth:sanctum', 'active', 'role:admin'])
            ->get('/api/test/admin-area', fn () => ApiResponse::success('admin ok'));
        Route::middleware(['api', 'auth:sanctum', 'active', 'permission:products.moderate'])
            ->get('/api/test/moderation', fn () => ApiResponse::success('moderation ok'));
    }

    private function seller(string $storeFactoryState = 'active'): User
    {
        $user = $this->customer();
        $user->assignRole('seller');
        Store::factory()->{$storeFactoryState}()->for($user, 'owner')->create();

        return $user;
    }

    public function test_customer_is_denied_seller_and_admin_areas(): void
    {
        $this->actingAs($this->customer());

        $this->getJson('/api/test/seller-area')->assertForbidden();
        $this->getJson('/api/test/admin-area')->assertForbidden()->assertJsonPath('message', 'This action is unauthorized.');
        $this->getJson('/api/test/moderation')->assertForbidden();
    }

    public function test_seller_needs_an_active_store(): void
    {
        $this->actingAs($this->seller('active'))->getJson('/api/test/seller-area')->assertOk();
        $this->actingAs($this->seller('suspended'))->getJson('/api/test/seller-area')->assertForbidden();

        // A pending application alone never grants seller access.
        $applicant = $this->customer();
        StoreApplication::factory()->for($applicant)->create();
        $this->actingAs($applicant)->getJson('/api/test/seller-area')->assertForbidden();
    }

    public function test_admin_has_admin_area_and_permissions(): void
    {
        $admin = $this->customer();
        $admin->assignRole('admin');
        $this->actingAs($admin);

        $this->getJson('/api/test/admin-area')->assertOk();
        $this->getJson('/api/test/moderation')->assertOk();
        $this->getJson('/api/test/seller-area')->assertForbidden();
    }

    public function test_me_exposes_roles_permissions_and_store_for_the_spa(): void
    {
        $seller = $this->seller();

        $this->actingAs($seller)->getJson('/api/v1/auth/me')
            ->assertOk()
            ->assertJsonPath('data.is_seller', true)
            ->assertJsonPath('data.is_admin', false)
            ->assertJsonPath('data.roles', ['customer', 'seller'])
            ->assertJsonPath('data.store.slug', $seller->store->slug)
            ->assertJsonPath('data.store.status', 'active')
            ->assertJsonFragment(['products.manage']);
    }
}
