<?php

namespace App\Services\Account;

use App\Models\User;
use App\Models\UserAddress;
use Illuminate\Support\Facades\DB;

/**
 * Keeps the invariant "a user has at most one default address" and makes the
 * first address the default automatically.
 */
class AddressService
{
    /** @param array<string, mixed> $data */
    public function create(User $user, array $data): UserAddress
    {
        return DB::transaction(function () use ($user, $data) {
            User::query()->whereKey($user->id)->lockForUpdate()->first();

            $makeDefault = ($data['is_default'] ?? false) || ! $user->addresses()->exists();
            if ($makeDefault) {
                $user->addresses()->update(['is_default' => false]);
            }

            return $user->addresses()->create([...$data, 'is_default' => $makeDefault]);
        });
    }

    /** @param array<string, mixed> $data */
    public function update(UserAddress $address, array $data): UserAddress
    {
        return DB::transaction(function () use ($address, $data) {
            if (($data['is_default'] ?? false) && ! $address->is_default) {
                $this->clearDefault($address);
            }
            // Un-setting the only default is not allowed: keep it default.
            if (array_key_exists('is_default', $data) && ! $data['is_default'] && $address->is_default) {
                unset($data['is_default']);
            }
            $address->update($data);

            return $address;
        });
    }

    public function setDefault(UserAddress $address): UserAddress
    {
        return DB::transaction(function () use ($address) {
            $this->clearDefault($address);
            $address->update(['is_default' => true]);

            return $address;
        });
    }

    public function delete(UserAddress $address): void
    {
        DB::transaction(function () use ($address) {
            $wasDefault = $address->is_default;
            $userId = $address->user_id;
            $address->delete();

            if ($wasDefault) {
                UserAddress::query()->where('user_id', $userId)->oldest('id')->first()?->update(['is_default' => true]);
            }
        });
    }

    private function clearDefault(UserAddress $address): void
    {
        UserAddress::query()->where('user_id', $address->user_id)->whereKeyNot($address->id)->update(['is_default' => false]);
    }
}
