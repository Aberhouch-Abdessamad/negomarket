<?php

namespace App\Services\Marketplace;

use App\Enums\ProductStatus;
use App\Enums\StoreStatus;
use App\Http\Resources\Marketplace\CategoryResource;
use App\Models\Category;
use Illuminate\Database\Eloquent\Builder;

class CategoryService
{
    public function __construct(private readonly CatalogCache $cache) {}

    /**
     * Active category tree with visible-product counts (children counts roll up into parents).
     * Cached as plain arrays (models are never unserialized from cache).
     *
     * @return list<array<string, mixed>>
     */
    public function tree(): array
    {
        return $this->cache->remember('categories:tree', 600, function () {
            $visible = fn (Builder $q) => $q->where('status', ProductStatus::Published)
                ->whereHas('store', fn (Builder $s) => $s->where('status', StoreStatus::Active));

            $roots = Category::query()->active()->roots()->orderBy('sort_order')
                ->withCount(['products' => $visible])
                ->with(['children' => fn ($q) => $q->active()->withCount(['products' => $visible])])
                ->get();

            foreach ($roots as $root) {
                $root->products_count += $root->children->sum('products_count');
            }

            return CategoryResource::collection($roots)->resolve();
        });
    }

    /** @return list<int> the category and its direct children (tree is two levels deep). */
    public function idsWithDescendants(string $slug): array
    {
        $category = Category::query()->active()->where('slug', $slug)->first();
        if (! $category) {
            return [];
        }

        return [$category->id, ...Category::query()->active()->where('parent_id', $category->id)->pluck('id')->all()];
    }

    public function findBySlug(string $slug): Category
    {
        return Category::query()->active()->where('slug', $slug)
            ->with(['parent', 'children' => fn ($q) => $q->active()])
            ->firstOrFail();
    }
}
