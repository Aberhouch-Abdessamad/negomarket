<?php

namespace Tests\Feature\Seller;

use App\Enums\StoreStatus;
use App\Models\ActivityLog;
use App\Models\Store;
use App\Models\StoreApplication;
use App\Models\User;
use App\Notifications\Seller\SellerApplicationReviewedNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\Concerns\ActsAsSpa;
use Tests\TestCase;

class OnboardingTest extends TestCase
{
    use ActsAsSpa, RefreshDatabase;

    private function admin(): User
    {
        return tap($this->customer())->assignRole('admin');
    }

    private function apply(User $user, array $overrides = [])
    {
        return $this->actingAs($user)->postJson('/api/v1/seller/applications', array_merge([
            'business_name' => 'Sahara Outdoor Gear',
            'description' => 'Camping and hiking equipment for desert trips.',
            'contact_phone' => '0612345678',
            'address' => '12 Avenue Mohammed V',
            'city' => 'Marrakesh',
            'accept_seller_terms' => true,
        ], $overrides));
    }

    public function test_full_application_approval_flow_grants_seller_access_on_the_same_account(): void
    {
        Notification::fake();
        $user = $this->customer();

        $this->getJson('/api/v1/seller/products')->assertUnauthorized();
        $this->apply($user)->assertCreated()->assertJsonPath('data.status', 'pending');
        $this->actingAs($user)->getJson('/api/v1/seller/application')->assertJsonPath('data.status', 'pending');
        $this->actingAs($user)->getJson('/api/v1/seller/dashboard')->assertForbidden();

        $application = StoreApplication::firstOrFail();
        $this->actingAs($this->admin())->patchJson("/api/v1/admin/seller-applications/{$application->id}/approve")
            ->assertOk()
            ->assertJsonPath('data.status', 'approved')
            ->assertJsonPath('data.store.slug', 'sahara-outdoor-gear')
            ->assertJsonPath('data.store.status', 'active');

        $user->refresh();
        $this->assertTrue($user->hasRole('seller'));
        $this->assertTrue($user->hasRole('customer'));
        $this->assertSame(StoreStatus::Active, $user->store->status);
        $this->assertSame('Marrakesh', $user->store->city);
        $this->assertSame(1, $user->store->addresses()->count());
        Notification::assertSentTo($user, SellerApplicationReviewedNotification::class);
        $this->assertDatabaseHas(ActivityLog::class, ['action' => 'seller_application.approved']);

        $this->actingAs($user)->getJson('/api/v1/auth/me')->assertJsonPath('data.is_seller', true);
        $this->actingAs($user)->getJson('/api/v1/seller/dashboard')->assertOk();
    }

    public function test_rejection_with_notes_and_reapplication(): void
    {
        Notification::fake();
        $user = $this->customer();
        $this->apply($user)->assertCreated();
        $this->apply($user)->assertJsonValidationErrors(['business_name' => 'already under review']);

        $app = StoreApplication::firstOrFail();
        $admin = $this->admin();
        $this->actingAs($admin)->patchJson("/api/v1/admin/seller-applications/{$app->id}/reject", ['notes' => ''])->assertJsonValidationErrors('notes');
        $this->actingAs($admin)->patchJson("/api/v1/admin/seller-applications/{$app->id}/reject", ['notes' => 'Please add a valid business address.'])
            ->assertOk()->assertJsonPath('data.admin_notes', 'Please add a valid business address.');
        $this->actingAs($admin)->patchJson("/api/v1/admin/seller-applications/{$app->id}/approve")->assertJsonValidationErrors('status');

        $this->assertFalse($user->fresh()->hasRole('seller'));
        $this->assertNull($user->fresh()->store);
        $this->apply($user, ['address' => '99 Rue Valid'])->assertCreated();
    }

    public function test_application_validation_and_authorization(): void
    {
        $unverified = $this->customer(['email_verified_at' => null]);
        $this->apply($unverified)->assertCreated();

        $user = $this->customer();
        $this->apply($user, ['business_name' => '', 'description' => 'short', 'accept_seller_terms' => false])
            ->assertJsonValidationErrors(['business_name', 'description', 'accept_seller_terms']);

        $seller = $this->customer();
        $seller->assignRole('seller');
        Store::factory()->active()->for($seller, 'owner')->create();
        $this->apply($seller)->assertJsonValidationErrors(['business_name' => 'already have a store']);

        $this->actingAs($user)->getJson('/api/v1/admin/seller-applications')->assertForbidden();
        $pending = StoreApplication::factory()->create();
        $this->actingAs($user)->patchJson("/api/v1/admin/seller-applications/{$pending->id}/approve")->assertForbidden();
        $this->actingAs($seller)->patchJson("/api/v1/admin/seller-applications/{$pending->id}/approve")->assertForbidden();
    }

    public function test_admin_lists_and_filters_applications(): void
    {
        StoreApplication::factory()->count(2)->create();
        StoreApplication::factory()->rejected()->create(['business_name' => 'Rejected Co']);

        $this->actingAs($this->admin())->getJson('/api/v1/admin/seller-applications')
            ->assertOk()->assertJsonCount(3, 'data')->assertJsonPath('meta.pending_count', 2)
            ->assertJsonPath('data.0.status', 'pending')->assertJsonStructure(['data' => [['applicant' => ['email']]]]);
        $this->getJson('/api/v1/admin/seller-applications?status=rejected&q=Rejected')->assertJsonCount(1, 'data');
    }

    public function test_store_slug_is_unique(): void
    {
        Store::factory()->create(['slug' => 'sahara-outdoor-gear']);
        $user = $this->customer();
        $this->apply($user)->assertCreated();

        $this->actingAs($this->admin())->patchJson('/api/v1/admin/seller-applications/'.StoreApplication::latest('id')->value('id').'/approve')
            ->assertOk()->assertJsonPath('data.store.slug', 'sahara-outdoor-gear-2');
    }
}
