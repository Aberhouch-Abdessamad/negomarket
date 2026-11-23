<?php

namespace Tests\Feature\Database;

use App\Models\Category;
use App\Models\Setting;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class SeedersTest extends TestCase
{
    use RefreshDatabase;

    public function test_database_seeder_creates_users_and_reference_data_only_and_is_idempotent(): void
    {
        $this->seed(DatabaseSeeder::class);
        $counts = [User::count(), Category::count(), Setting::count()];
        $this->seed(DatabaseSeeder::class);

        $this->assertSame($counts, [User::count(), Category::count(), Setting::count()]);
        $this->assertSame(['admin', 'customer', 'seller'], Role::orderBy('name')->pluck('name')->all());

        // Demo users only: business data is created through the application, never by the seeder.
        $this->assertDatabaseCount('stores', 0);
        $this->assertDatabaseCount('products', 0);
        $this->assertDatabaseCount('store_applications', 0);
        $this->assertDatabaseCount('user_addresses', 0);

        $admin = User::where('email', 'admin@negomarket.test')->firstOrFail();
        $this->assertTrue($admin->hasRole('admin'));
        $this->assertTrue($admin->hasPermissionTo('store-applications.review'));

        $seller = User::where('email', 'seller@negomarket.test')->firstOrFail();
        $this->assertTrue($seller->hasRole('seller'));
        $this->assertTrue($seller->hasRole('customer'), 'Sellers keep their customer role (single account).');
        $this->assertTrue($seller->hasPermissionTo('products.manage'));
        $this->assertFalse($seller->isApprovedSeller(), 'No store is seeded; sellers open one through the app.');

        $customer = User::where('email', 'customer@negomarket.test')->firstOrFail();
        $this->assertFalse($customer->hasRole('seller'));
        $this->assertFalse($customer->isApprovedSeller());
        $this->assertFalse($customer->hasPermissionTo('products.manage'));
        $this->assertNotNull($customer->email_verified_at);

        $this->assertSame(48, Setting::get('negotiation.offer_expiry_hours'));
    }

    public function test_roles_seeder_alone_is_safe_for_production(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        $this->assertSame(0, User::count());
        $this->assertCount(count(RolesAndPermissionsSeeder::ADMIN), Role::findByName('admin')->permissions);
    }
}
