<?php

namespace App\Services\Admin;

use App\Enums\StoreStatus;
use App\Models\Store;
use App\Models\User;
use App\Services\Audit\ActivityLogger;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;

/** Store directory administration: browse and activate/suspend a storefront. */
class StoreAdminService
{
    public function __construct(private readonly ActivityLogger $activity) {}

    /** @param array<string, mixed> $filters */
    public function index(array $filters): LengthAwarePaginator
    {
        return Store::query()
            ->when($filters['status'] ?? null, fn (Builder $q, string $status) => $q->where('status', $status))
            ->when($filters['q'] ?? null, function (Builder $q, string $term) {
                $like = '%'.addcslashes($term, '\\%_').'%';
                $q->where(fn (Builder $w) => $w
                    ->where('name', 'like', $like)
                    ->orWhere('slug', 'like', $like)
                    ->orWhere('city', 'like', $like)
                    ->orWhereHas('owner', fn (Builder $o) => $o
                        ->where('name', 'like', $like)
                        ->orWhere('email', 'like', $like)));
            })
            ->with('owner:id,name,email')
            ->withCount(['products', 'orders'])
            ->latest('id')
            ->paginate($filters['per_page'] ?? 20);
    }

    public function show(Store $store): Store
    {
        return $store->load('owner:id,name,email,phone')
            ->loadCount(['products', 'orders', 'negotiations', 'reviews']);
    }

    public function updateStatus(User $actor, Store $store, StoreStatus $status): Store
    {
        $previous = $store->status;
        $attributes = ['status' => $status];

        if ($status === StoreStatus::Active && $store->approved_at === null) {
            $attributes['approved_at'] = now();
        }

        $store->forceFill($attributes)->save();

        $this->activity->log('store.status_changed', $actor, $store, [
            'from' => $previous->value,
            'to' => $status->value,
        ]);

        return $this->show($store->fresh());
    }
}
