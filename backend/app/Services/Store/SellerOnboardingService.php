<?php

namespace App\Services\Store;

use App\Enums\StoreAddressType;
use App\Enums\StoreApplicationStatus;
use App\Enums\StoreStatus;
use App\Models\Store;
use App\Models\StoreApplication;
use App\Models\User;
use App\Notifications\Seller\SellerApplicationReviewedNotification;
use App\Services\Audit\ActivityLogger;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Customer → seller workflow (same account):
 * apply → admin approves (seller role + active store created atomically) or rejects (with notes).
 */
class SellerOnboardingService
{
    public function __construct(private readonly ActivityLogger $activity) {}

    /** @param array{business_name: string, description?: string|null, contact_phone: string, address: string, city: string} $data */
    public function apply(User $user, array $data): StoreApplication
    {
        if ($user->store()->exists()) {
            throw ValidationException::withMessages(['business_name' => 'You already have a store.']);
        }
        if ($user->storeApplications()->where('status', StoreApplicationStatus::Pending)->exists()) {
            throw ValidationException::withMessages(['business_name' => 'Your application is already under review.']);
        }

        $application = new StoreApplication($data);
        $application->user()->associate($user);
        $application->save(); // a concurrent duplicate is still blocked by the pending_key UNIQUE index

        $this->activity->log('seller_application.submitted', $user, $application);

        return $application;
    }

    public function approve(StoreApplication $application, User $admin, ?string $notes = null): StoreApplication
    {
        $application = DB::transaction(function () use ($application, $admin, $notes) {
            /** @var StoreApplication $locked */
            $locked = StoreApplication::query()->whereKey($application->id)->lockForUpdate()->firstOrFail();
            $this->assertPending($locked);

            $locked->forceFill([
                'status' => StoreApplicationStatus::Approved,
                'admin_notes' => $notes,
                'reviewed_by' => $admin->id,
                'reviewed_at' => now(),
            ])->save();

            $owner = $locked->user;
            $owner->assignRole('seller');

            $store = Store::withTrashed()->firstWhere('user_id', $owner->id) ?? new Store;
            if ($store->exists) {
                $store->restore();
            } else {
                $store->fill([
                    'name' => $locked->business_name,
                    'description' => $locked->description,
                    'phone' => $locked->contact_phone,
                    'email' => $owner->email,
                    'address' => $locked->address,
                    'city' => $locked->city,
                ]);
                $store->forceFill(['user_id' => $owner->id, 'slug' => $this->uniqueSlug($locked->business_name)]);
            }
            $store->forceFill([
                'store_application_id' => $locked->id,
                'status' => StoreStatus::Active,
                'approved_at' => now(),
            ])->save();

            if (! $store->addresses()->exists()) {
                $store->addresses()->create([
                    'type' => StoreAddressType::Business,
                    'label' => 'Business address',
                    'contact_name' => $owner->name,
                    'phone' => $locked->contact_phone,
                    'address_line1' => $locked->address,
                    'city' => $locked->city,
                    'country' => 'MA',
                    'is_default' => true,
                ]);
            }

            return $locked;
        });

        $this->activity->log('seller_application.approved', $admin, $application, ['user_id' => $application->user_id]);
        $application->user->notify(new SellerApplicationReviewedNotification($application));

        return $application->load('store');
    }

    public function reject(StoreApplication $application, User $admin, string $notes): StoreApplication
    {
        $application = DB::transaction(function () use ($application, $admin, $notes) {
            $locked = StoreApplication::query()->whereKey($application->id)->lockForUpdate()->firstOrFail();
            $this->assertPending($locked);
            $locked->forceFill([
                'status' => StoreApplicationStatus::Rejected,
                'admin_notes' => $notes,
                'reviewed_by' => $admin->id,
                'reviewed_at' => now(),
            ])->save();

            return $locked;
        });

        $this->activity->log('seller_application.rejected', $admin, $application, ['user_id' => $application->user_id]);
        $application->user->notify(new SellerApplicationReviewedNotification($application));

        return $application;
    }

    private function assertPending(StoreApplication $application): void
    {
        if ($application->status !== StoreApplicationStatus::Pending) {
            throw ValidationException::withMessages(['status' => 'This application has already been reviewed.']);
        }
    }

    private function uniqueSlug(string $name): string
    {
        $base = Str::slug(Str::limit($name, 60, '')) ?: 'store';
        $slug = $base;
        $i = 2;
        while (Store::withTrashed()->where('slug', $slug)->exists()) {
            $slug = "{$base}-{$i}";
            $i++;
        }

        return $slug;
    }
}
