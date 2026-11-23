<?php

namespace App\Services\Admin;

use App\Models\Setting;
use App\Models\User;
use App\Services\Audit\ActivityLogger;
use Database\Seeders\SettingsSeeder;
use Illuminate\Support\Facades\DB;

/** Platform settings surfaced by the admin panel. */
class SettingAdminService
{
    public function __construct(private readonly ActivityLogger $activity) {}

    /** @return list<array{key: string, value: mixed, default: mixed}> */
    public function all(): array
    {
        $stored = Setting::query()->orderBy('key')->get()->keyBy('key');

        return collect(SettingsSeeder::DEFAULTS)
            ->map(fn ($default, string $key) => [
                'key' => $key,
                'value' => $stored->get($key)?->value ?? $default,
                'default' => $default,
            ])
            ->values()
            ->all();
    }

    /**
     * Update the settings present in the validated payload only.
     *
     * @param  array<string, mixed>  $settings
     * @return list<array{key: string, value: mixed, default: mixed}>
     */
    public function update(User $actor, array $settings): array
    {
        $allowed = array_keys(SettingsSeeder::DEFAULTS);
        $changes = [];

        DB::transaction(function () use ($settings, $allowed, &$changes) {
            foreach ($settings as $key => $value) {
                if (! in_array($key, $allowed, true)) {
                    continue;
                }

                $previous = Setting::get($key);
                Setting::put($key, $value);
                $changes[$key] = ['from' => $previous, 'to' => $value];
            }
        });

        if ($changes !== []) {
            $this->activity->log('settings.updated', $actor, null, ['changes' => $changes]);
        }

        return $this->all();
    }
}
