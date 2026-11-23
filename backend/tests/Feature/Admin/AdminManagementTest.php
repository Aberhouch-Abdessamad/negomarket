<?php

namespace Tests\Feature\Admin;

use App\Enums\StoreStatus;
use App\Enums\UserStatus;
use App\Models\ActivityLog;
use App\Models\Setting;
use App\Models\Store;
use App\Models\User;
use App\Services\Audit\ActivityLogger;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\ActsAsSpa;
use Tests\Concerns\BuildsNegotiations;
use Tests\Concerns\BuildsOrders;
use Tests\TestCase;

class AdminManagementTest extends TestCase
{
    use ActsAsSpa, BuildsNegotiations, BuildsOrders, RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->create();
        $this->admin->syncRoles('admin');
    }

    public function test_only_admins_can_reach_the_admin_panel(): void
    {
        $customer = $this->customer();

        $this->actingAs($customer)->getJson('/api/v1/admin/users')->assertForbidden();
        $this->actingAs($customer)->getJson('/api/v1/admin/dashboard')->assertForbidden();
        $this->actingAs($this->admin)->getJson('/api/v1/admin/users')->assertOk();
    }

    public function test_admins_can_filter_and_view_accounts(): void
    {
        $seller = $this->sellerWithStore();
        $customer = $this->customer();

        $response = $this->actingAs($this->admin)
            ->getJson('/api/v1/admin/users?role=seller')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $seller->id);

        $this->assertContains('seller', $response->json('data.0.roles'));

        $this->actingAs($this->admin)
            ->getJson('/api/v1/admin/users/'.$customer->id)
            ->assertOk()
            ->assertJsonPath('data.id', $customer->id)
            ->assertJsonPath('data.status', 'active');
    }

    public function test_suspending_an_account_revokes_tokens_and_is_logged(): void
    {
        $customer = $this->customer();
        $customer->createToken('phone');

        $this->assertDatabaseCount('personal_access_tokens', 1);

        $this->actingAs($this->admin)
            ->patchJson('/api/v1/admin/users/'.$customer->id.'/status', ['status' => 'suspended'])
            ->assertOk()
            ->assertJsonPath('data.status', 'suspended');

        $this->assertSame(UserStatus::Suspended, $customer->fresh()->status);
        $this->assertDatabaseCount('personal_access_tokens', 0);
        $this->assertDatabaseHas('activity_logs', [
            'action' => 'user.status_changed',
            'subject_id' => $customer->id,
        ]);
    }

    public function test_an_admin_cannot_suspend_themselves_or_another_admin(): void
    {
        $otherAdmin = User::factory()->create();
        $otherAdmin->syncRoles('admin');

        $this->actingAs($this->admin)
            ->patchJson('/api/v1/admin/users/'.$this->admin->id.'/status', ['status' => 'suspended'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('status');

        $this->actingAs($this->admin)
            ->patchJson('/api/v1/admin/users/'.$otherAdmin->id.'/status', ['status' => 'suspended'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('status');

        $this->assertSame(UserStatus::Active, $otherAdmin->fresh()->status);
    }

    public function test_admins_can_browse_and_activate_stores(): void
    {
        $seller = $this->customer();
        $seller->assignRole('seller');
        $store = Store::factory()->for($seller, 'owner')->create([
            'status' => StoreStatus::Pending,
            'approved_at' => null,
        ]);

        $this->actingAs($this->admin)
            ->getJson('/api/v1/admin/stores?status=pending')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $store->id)
            ->assertJsonPath('data.0.owner.id', $seller->id);

        $this->actingAs($this->admin)
            ->patchJson('/api/v1/admin/stores/'.$store->id.'/status', ['status' => 'active'])
            ->assertOk()
            ->assertJsonPath('data.status', 'active');

        $store->refresh();
        $this->assertSame(StoreStatus::Active, $store->status);
        $this->assertNotNull($store->approved_at);
        $this->assertDatabaseHas('activity_logs', [
            'action' => 'store.status_changed',
            'subject_id' => $store->id,
            'user_id' => $this->admin->id,
        ]);
    }

    public function test_admins_can_read_and_update_platform_settings(): void
    {
        $this->actingAs($this->admin)
            ->getJson('/api/v1/admin/settings')
            ->assertOk()
            ->assertJsonFragment(['key' => 'negotiation.offer_expiry_hours', 'value' => 48]);

        $this->actingAs($this->admin)
            ->putJson('/api/v1/admin/settings', [
                'settings' => [
                    'negotiation.offer_expiry_hours' => 72,
                    'reviews.require_moderation' => false,
                    'checkout.currency' => 'EUR',
                ],
            ])
            ->assertOk()
            ->assertJsonFragment(['key' => 'negotiation.offer_expiry_hours', 'value' => 72])
            ->assertJsonFragment(['key' => 'reviews.require_moderation', 'value' => false]);

        $this->assertSame(72, Setting::get('negotiation.offer_expiry_hours'));
        $this->assertDatabaseHas('activity_logs', ['action' => 'settings.updated']);
    }

    public function test_invalid_settings_are_rejected(): void
    {
        $this->actingAs($this->admin)
            ->putJson('/api/v1/admin/settings', [
                'settings' => ['negotiation.offer_expiry_hours' => 0],
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('settings.negotiation.offer_expiry_hours');
    }

    public function test_activity_logs_can_be_filtered_by_action(): void
    {
        app(ActivityLogger::class)->log('test.action', $this->admin, null, ['example' => true]);

        $this->actingAs($this->admin)
            ->getJson('/api/v1/admin/activity-logs?action=test.action')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.action', 'test.action')
            ->assertJsonPath('data.0.user.id', $this->admin->id);

        $this->assertSame(1, ActivityLog::query()->where('action', 'test.action')->count());
    }
}
