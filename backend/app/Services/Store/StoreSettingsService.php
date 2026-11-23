<?php

namespace App\Services\Store;

use App\Models\Store;
use App\Models\StoreAddress;
use App\Models\User;
use App\Services\Audit\ActivityLogger;
use App\Services\Media\ImageProcessor;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class StoreSettingsService
{
    public function __construct(
        private readonly ImageProcessor $images,
        private readonly ActivityLogger $activity,
    ) {}

    /** @param array<string, mixed> $data */
    public function update(Store $store, array $data, User $actor): Store
    {
        $store->fill($data)->save();
        $this->activity->log('store.updated', $actor, $store, ['changes' => array_keys($store->getChanges())]);

        return $store;
    }

    /** @param 'logo'|'banner' $kind */
    public function updateImage(Store $store, string $kind, UploadedFile $file): Store
    {
        $size = $kind === 'logo' ? [400, 400] : [1600, 400];
        $path = $this->images->store($file, "stores/{$store->id}", ['main' => $size])['main'];

        $old = $store->{$kind};
        $store->forceFill([$kind => $path])->save();
        if ($old && $old !== $path && ! str_starts_with($old, 'demo/')) {
            Storage::disk('public')->delete($old);
        }

        return $store;
    }

    /** @param array<string, mixed> $data */
    public function saveAddress(Store $store, array $data, ?StoreAddress $address = null): StoreAddress
    {
        return DB::transaction(function () use ($store, $data, $address) {
            $address ??= new StoreAddress;
            $isFirstOfType = ! $store->addresses()->where('type', $data['type'])->whereKeyNot($address->id)->exists();
            $makeDefault = ($data['is_default'] ?? false) || $isFirstOfType;

            if ($makeDefault) {
                $store->addresses()->where('type', $data['type'])->whereKeyNot($address->id)->update(['is_default' => false]);
            }
            $address->fill([...$data, 'is_default' => $makeDefault || ($address->exists && $address->is_default && $address->type?->value === $data['type'])]);
            $address->store()->associate($store);
            $address->save();

            return $address;
        });
    }

    public function deleteAddress(StoreAddress $address): void
    {
        DB::transaction(function () use ($address) {
            $address->delete();
            if ($address->is_default) {
                StoreAddress::query()->where('store_id', $address->store_id)->where('type', $address->type)->oldest('id')->first()?->update(['is_default' => true]);
            }
        });
    }
}
