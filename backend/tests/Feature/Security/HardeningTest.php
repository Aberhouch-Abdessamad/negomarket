<?php

namespace Tests\Feature\Security;

use App\Models\Product;
use App\Models\Store;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\ActsAsSpa;
use Tests\TestCase;

/**
 * Phase 11 cross-cutting safety nets: admin-only writes, bounded public
 * pagination, settings whitelisting and throttling on sensitive writes.
 */
class HardeningTest extends TestCase
{
    use ActsAsSpa, RefreshDatabase;

    private User $admin;

    private User $seller;

    private Product $product;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->create();
        $this->admin->syncRoles('admin');

        $this->seller = $this->customer();
        $this->seller->assignRole('seller');
        $store = Store::factory()->active()->for($this->seller, 'owner')->create();
        $this->product = Product::factory()->published()->for($store)->create();
    }

    public function test_admin_write_endpoints_are_closed_to_sellers(): void
    {
        $this->actingAs($this->seller)
            ->patchJson('/api/v1/admin/products/'.$this->product->id.'/approve')
            ->assertForbidden()
            ->assertJsonPath('message', 'This action is unauthorized.');

        $this->actingAs($this->seller)
            ->putJson('/api/v1/admin/settings', ['settings' => ['checkout.currency' => 'EUR']])
            ->assertForbidden();
    }

    public function test_unknown_settings_keys_are_rejected(): void
    {
        $this->actingAs($this->admin)
            ->putJson('/api/v1/admin/settings', [
                'settings' => [
                    'checkout.currency' => 'MAD',
                    'attacker.injected' => true,
                ],
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('settings.attacker.injected');
    }

    public function test_public_review_pagination_is_bounded(): void
    {
        $url = '/api/v1/products/'.$this->product->slug.'/reviews';

        $this->getJson($url.'?per_page=500')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('per_page');

        $this->getJson($url.'?per_page=50')->assertOk();
    }

    public function test_seller_product_pagination_is_bounded(): void
    {
        $this->actingAs($this->seller)
            ->getJson('/api/v1/seller/products?per_page=500')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('per_page');

        $this->actingAs($this->seller)
            ->getJson('/api/v1/seller/products?per_page=50')
            ->assertOk();
    }

    public function test_sensitive_admin_writes_are_rate_limited(): void
    {
        for ($i = 0; $i < 10; $i++) {
            $this->actingAs($this->admin)
                ->putJson('/api/v1/admin/settings', ['settings' => ['checkout.currency' => 'MAD']])
                ->assertOk();
        }

        $this->actingAs($this->admin)
            ->putJson('/api/v1/admin/settings', ['settings' => ['checkout.currency' => 'MAD']])
            ->assertStatus(429)
            ->assertJsonPath('success', false)
            ->assertJsonPath('message', 'Too many requests. Please slow down.');
    }
}
