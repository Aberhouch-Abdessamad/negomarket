<?php

namespace App\Services\Marketplace;

use App\Http\Resources\Marketplace\ProductCardResource;
use App\Http\Resources\Marketplace\StoreResource;
use App\Models\Product;
use App\Models\Store;
use Illuminate\Http\Request;

/** Homepage sections from real data, cached as a whole (public data only). */
class HomeService
{
    public function __construct(
        private readonly ProductCatalogService $products,
        private readonly StoreDirectoryService $stores,
        private readonly CategoryService $categories,
        private readonly CatalogCache $cache,
    ) {}

    /** @return array<string, mixed> */
    public function sections(Request $request): array
    {
        return $this->cache->remember('home:sections', 300, function () use ($request) {
            $cards = fn ($query, int $limit = 8) => ProductCardResource::collection($query->limit($limit)->get())->resolve($request);

            return [
                'stats' => [
                    'products' => Product::query()->visible()->count(),
                    'stores' => Store::query()->active()->count(),
                    'negotiable_products' => Product::query()->visible()->where('allow_negotiation', true)->count(),
                ],
                'categories' => $this->categories->tree(),
                'featured' => $cards($this->products->cardQuery()->where('products.featured', true)->latest('products.published_at')),
                'latest' => $cards($this->products->cardQuery()->latest('products.published_at')->orderByDesc('products.id')),
                'popular' => $cards($this->products->cardQuery()->orderByDesc('products.sales_count')->orderByDesc('products.views_count')),
                'negotiable' => $cards($this->products->cardQuery()->where('products.allow_negotiation', true)->orderByDesc('products.views_count')),
                'stores' => StoreResource::collection($this->stores->featured(6))->resolve($request),
            ];
        });
    }
}
