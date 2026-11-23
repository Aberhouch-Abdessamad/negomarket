<?php

namespace App\Services\Marketplace;

use App\Enums\ProductStatus;
use App\Models\Store;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;

class StoreDirectoryService
{
    private function base(): Builder
    {
        return Store::query()->active()->withCount([
            'products as visible_products_count' => fn (Builder $q) => $q->where('status', ProductStatus::Published),
            'products as negotiable_products_count' => fn (Builder $q) => $q->where('status', ProductStatus::Published)->where('allow_negotiation', true),
        ]);
    }

    /** @param array{q?: string, city?: string, sort?: string, per_page?: int} $filters */
    public function search(array $filters): LengthAwarePaginator
    {
        $query = $this->base();

        if (filled($filters['q'] ?? null)) {
            $query->where('name', 'like', '%'.addcslashes(trim((string) $filters['q']), '\\%_').'%');
        }
        if (filled($filters['city'] ?? null)) {
            $query->where('city', $filters['city']);
        }

        match ($filters['sort'] ?? 'rating') {
            'newest' => $query->orderByDesc('approved_at'),
            'name' => $query->orderBy('name'),
            default => $query->orderByDesc('rating_avg')->orderByDesc('visible_products_count'),
        };

        return $query->orderBy('id')->paginate(min((int) ($filters['per_page'] ?? 12), 48))->withQueryString();
    }

    public function findBySlug(string $slug): Store
    {
        return $this->base()->where('slug', $slug)->firstOrFail();
    }

    /** @return list<string> */
    public function cities(): array
    {
        return Store::query()->active()->whereNotNull('city')->distinct()->orderBy('city')->pluck('city')->all();
    }

    public function featured(int $limit = 6)
    {
        return $this->base()->having('visible_products_count', '>', 0)
            ->orderByDesc('rating_avg')->orderByDesc('visible_products_count')->limit($limit)->get();
    }
}
