<?php

namespace App\Services\Marketplace;

use App\Enums\ProductStatus;
use App\Enums\ReviewStatus;
use App\Enums\VariantStatus;
use App\Models\Category;
use App\Models\Product;
use App\Models\ProductReview;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Read-side of the public marketplace. Only published products of active
 * stores are ever returned (Product::visible()).
 */
class ProductCatalogService
{
    public const SORTS = ['newest', 'price_asc', 'price_desc', 'popular', 'rating'];

    public function __construct(private readonly CategoryService $categories) {}

    /** Base query for product cards (eager-loads everything a card needs: no N+1). */
    public function cardQuery(): Builder
    {
        return Product::query()
            ->visible()
            ->select('products.*')
            ->with(['primaryImage', 'store:id,name,slug', 'category:id,name,slug'])
            ->withCount(['variants' => fn (Builder $q) => $q->where('status', VariantStatus::Active)])
            ->withMin(['variants' => fn (Builder $q) => $q->where('status', VariantStatus::Active)->whereNotNull('price')], 'price');
    }

    /**
     * @param  array{q?: string, category?: string, store?: string, min_price?: numeric, max_price?: numeric, negotiable?: bool, min_rating?: numeric, in_stock?: bool, sort?: string, per_page?: int}  $filters
     */
    public function search(array $filters): LengthAwarePaginator
    {
        $query = $this->cardQuery();

        if (filled($filters['q'] ?? null)) {
            $this->applySearch($query, trim((string) $filters['q']));
        }

        if (filled($filters['category'] ?? null)) {
            $ids = $this->categories->idsWithDescendants((string) $filters['category']);
            $query->whereIn('products.category_id', $ids ?: [0]);
        }

        if (filled($filters['store'] ?? null)) {
            $query->whereHas('store', fn (Builder $q) => $q->where('slug', $filters['store']));
        }

        if (isset($filters['min_price'])) {
            $query->where('products.price', '>=', $filters['min_price']);
        }
        if (isset($filters['max_price'])) {
            $query->where('products.price', '<=', $filters['max_price']);
        }
        if (! empty($filters['negotiable'])) {
            $query->where('products.allow_negotiation', true);
        }
        if (isset($filters['min_rating'])) {
            $query->where('products.rating_avg', '>=', $filters['min_rating']);
        }
        if (! empty($filters['in_stock'])) {
            $query->where('products.stock_quantity', '>', 0);
        }

        $this->applySort($query, $filters['sort'] ?? 'newest');

        return $query->paginate(min((int) ($filters['per_page'] ?? 24), 48))->withQueryString();
    }

    /** Resolve a visible product by slug with everything the details page needs. */
    public function findBySlug(string $slug): Product
    {
        return Product::query()
            ->visible()
            ->where('slug', $slug)
            ->with([
                'images',
                'variants' => fn ($q) => $q->where('status', VariantStatus::Active)->orderBy('id'),
                'category.parent',
                'store' => fn ($q) => $q->withCount(['products as visible_products_count' => fn ($p) => $p->where('status', ProductStatus::Published)]),
            ])
            ->firstOrFail();
    }

    /** Same category first, then same store; excludes the product itself. */
    public function related(Product $product, int $limit = 8): Collection
    {
        return $this->cardQuery()
            ->whereKeyNot($product->id)
            ->where(fn (Builder $q) => $q->where('products.category_id', $product->category_id)->orWhere('products.store_id', $product->store_id))
            ->orderByRaw('products.category_id = ? DESC', [$product->category_id])
            ->orderByDesc('products.sales_count')
            ->limit($limit)
            ->get();
    }

    public function reviews(Product $product, int $perPage = 10): LengthAwarePaginator
    {
        return ProductReview::query()
            ->where('product_id', $product->id)
            ->where('status', ReviewStatus::Approved)
            ->with('author:id,name')
            ->latest()
            ->paginate(min($perPage, 50));
    }

    /** Counted asynchronously after the response; does not touch updated_at or the cache. */
    public function recordView(Product $product): void
    {
        dispatch(fn () => DB::table('products')->where('id', $product->id)->increment('views_count'))->afterResponse();
    }

    /** @return array<string, string> rating histogram for the details page */
    public function ratingBreakdown(Product $product): array
    {
        $rows = ProductReview::query()
            ->where('product_id', $product->id)
            ->where('status', ReviewStatus::Approved)
            ->selectRaw('rating, COUNT(*) as total')
            ->groupBy('rating')
            ->pluck('total', 'rating');

        return collect([5, 4, 3, 2, 1])->mapWithKeys(fn ($r) => [$r => (int) ($rows[$r] ?? 0)])->all();
    }

    private function applySearch(Builder $query, string $term): void
    {
        $like = '%'.addcslashes($term, '\\%_').'%';

        $query->where(function (Builder $q) use ($term, $like) {
            $q->where('products.sku', $term)
                ->orWhere('products.name', 'like', $like);

            if (mb_strlen($term) >= 3 && DB::getDriverName() === 'mysql') {
                $q->orWhereFullText(['products.name', 'products.description'], $term);
            }
        });
    }

    private function applySort(Builder $query, string $sort): void
    {
        match ($sort) {
            'price_asc' => $query->orderBy('products.price')->orderByDesc('products.id'),
            'price_desc' => $query->orderByDesc('products.price')->orderByDesc('products.id'),
            'popular' => $query->orderByDesc('products.sales_count')->orderByDesc('products.views_count')->orderByDesc('products.id'),
            'rating' => $query->orderByDesc('products.rating_avg')->orderByDesc('products.rating_count')->orderByDesc('products.id'),
            default => $query->orderByDesc('products.published_at')->orderByDesc('products.id'),
        };
    }

    /** Used by Category model consumers to avoid duplicated lookups. */
    public function categoryBySlug(string $slug): ?Category
    {
        return Category::query()->active()->where('slug', $slug)->first();
    }
}
