<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

/**
 * Idempotent: safe to run in every environment, including production.
 * Roles answer "what kind of user"; Policies (Phase 3+) answer "which records".
 */
class RolesAndPermissionsSeeder extends Seeder
{
    public const CUSTOMER = [
        'store-applications.create',
        'negotiations.create',
        'orders.create',
        'reviews.create',
        'disputes.create',
    ];

    public const SELLER = [
        'store.manage',
        'products.manage',
        'inventory.manage',
        'negotiations.respond',
        'orders.fulfil',
        'payments.collect',
        'reviews.reply',
        'analytics.view-own',
    ];

    public const ADMIN = [
        'users.manage',
        'roles.manage',
        'store-applications.review',
        'stores.manage',
        'products.moderate',
        'categories.manage',
        'orders.manage',
        'payments.manage',
        'negotiations.monitor',
        'disputes.manage',
        'reviews.moderate',
        'reports.view',
        'activity-logs.view',
        'settings.manage',
    ];

    public function run(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        foreach ([...self::CUSTOMER, ...self::SELLER, ...self::ADMIN] as $name) {
            Permission::findOrCreate($name, 'web');
        }

        Role::findOrCreate('customer', 'web')->syncPermissions(self::CUSTOMER);
        Role::findOrCreate('seller', 'web')->syncPermissions(self::SELLER);
        Role::findOrCreate('admin', 'web')->syncPermissions(self::ADMIN);

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
}
