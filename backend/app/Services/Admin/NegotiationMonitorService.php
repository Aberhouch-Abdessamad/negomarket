<?php

namespace App\Services\Admin;

use App\Models\Negotiation;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;

/** Read-only oversight of negotiation threads across the marketplace. */
class NegotiationMonitorService
{
    /** @param array<string, mixed> $filters */
    public function index(array $filters): LengthAwarePaginator
    {
        return Negotiation::query()
            ->when($filters['status'] ?? null, fn (Builder $q, string $status) => $q->where('status', $status))
            ->when($filters['store_id'] ?? null, fn (Builder $q, int $storeId) => $q->where('store_id', $storeId))
            ->when($filters['customer_id'] ?? null, fn (Builder $q, int $customerId) => $q->where('customer_id', $customerId))
            ->when($filters['q'] ?? null, function (Builder $q, string $term) {
                $like = '%'.addcslashes($term, '\\%_').'%';
                $q->where(fn (Builder $w) => $w
                    ->whereHas('product', fn (Builder $p) => $p->where('name', 'like', $like))
                    ->orWhereHas('store', fn (Builder $s) => $s->where('name', 'like', $like))
                    ->orWhereHas('customer', fn (Builder $c) => $c
                        ->where('name', 'like', $like)
                        ->orWhere('email', 'like', $like)));
            })
            ->with($this->listRelations())
            ->withCount('offers')
            ->withCount('messages')
            ->orderByDesc('last_activity_at')
            ->orderByDesc('id')
            ->paginate($filters['per_page'] ?? 20);
    }

    public function show(Negotiation $negotiation): Negotiation
    {
        return $negotiation->load([
            ...$this->listRelations(),
            'offers.sender:id,name,avatar_path',
            'messages.sender:id,name,avatar_path',
        ])->loadCount(['offers', 'messages']);
    }

    /** @return list<string> */
    private function listRelations(): array
    {
        return [
            'product.primaryImage:id,product_id,image_path,thumbnail_path',
            'variant',
            'store:id,name,slug,logo,user_id',
            'customer:id,name,email,avatar_path',
            'latestOffer.sender:id,name,avatar_path',
            'acceptedOffer.sender:id,name,avatar_path',
            'pendingOffer.sender:id,name,avatar_path',
        ];
    }
}
