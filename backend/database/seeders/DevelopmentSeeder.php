<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Development accounts for local use ONLY (never runs in production).
 * All accounts use the password "password".
 *
 * Only user records are seeded here. Stores, products, inventory, carts,
 * addresses and applications are created through the application so the
 * database always reflects real business flows.
 */
class DevelopmentSeeder extends Seeder
{
    private const PASSWORD = 'password';

    /** @var list<array{name: string, email: string, roles: list<string>}> */
    private const USERS = [
        ['name' => 'Admin NegoMarket', 'email' => 'admin@negomarket.test', 'roles' => ['admin', 'customer']],
        ['name' => 'Youssef Benali', 'email' => 'seller@negomarket.test', 'roles' => ['customer', 'seller']],
        ['name' => 'Fatima Zahra El Idrissi', 'email' => 'seller2@negomarket.test', 'roles' => ['customer', 'seller']],
        ['name' => 'Amine Tazi', 'email' => 'seller3@negomarket.test', 'roles' => ['customer', 'seller']],
        ['name' => 'Salma Customer', 'email' => 'customer@negomarket.test', 'roles' => ['customer']],
        ['name' => 'Karim Customer', 'email' => 'customer2@negomarket.test', 'roles' => ['customer']],
        ['name' => 'Hamza Applicant', 'email' => 'applicant@negomarket.test', 'roles' => ['customer']],
    ];

    public function run(): void
    {
        foreach (self::USERS as $data) {
            $user = User::query()->firstOrCreate(
                ['email' => $data['email']],
                [
                    'name' => $data['name'],
                    'password' => self::PASSWORD,
                    'phone' => '06'.random_int(10000000, 99999999),
                ],
            );

            $user->forceFill(['email_verified_at' => $user->email_verified_at ?? now()])->save();
            $user->syncRoles($data['roles']);
        }
    }
}
