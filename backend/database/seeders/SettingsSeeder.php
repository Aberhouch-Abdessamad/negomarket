<?php

namespace Database\Seeders;

use App\Models\Setting;
use Illuminate\Database\Seeder;

/** Platform defaults. Existing values are never overwritten. */
class SettingsSeeder extends Seeder
{
    public const DEFAULTS = [
        'negotiation.offer_expiry_hours' => 48,
        'negotiation.expiry_days' => 7,
        'negotiation.accepted_checkout_hours' => 48,
        'negotiation.max_open_per_customer' => 20,
        'checkout.currency' => 'MAD',
        'checkout.default_shipping_cost' => 0,
        'reviews.require_moderation' => true,
        'products.require_moderation' => true,
        'products.max_images' => 8,
    ];

    public function run(): void
    {
        foreach (self::DEFAULTS as $key => $value) {
            Setting::query()->firstOrCreate(['key' => $key], ['value' => $value]);
        }
    }
}
