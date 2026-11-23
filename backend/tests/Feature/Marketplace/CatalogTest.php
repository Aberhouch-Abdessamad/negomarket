<?php

namespace Tests\Feature\Marketplace;

use App\Enums\ReviewStatus;
use App\Models\Category;
use App\Models\Product;
use App\Models\ProductImage;
use App\Models\ProductReview;
use App\Models\ProductVariant;
use App\Models\Store;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\Concerns\ActsAsSpa;
use Tests\TestCase;

class CatalogTest extends TestCase
{
    use ActsAsSpa, RefreshDatabase;

    private Store $store;

    private Category $phones;

    private Category $electronics;

    protected function setUp(): void
    {
        parent::setUp();
        $this->store = Store::factory()->active()->create(['name' => 'Atlas', 'slug' => 'atlas']);
        $this->electronics = Category::factory()->create(['name' => 'Electronics', 'slug' => 'electronics']);
        $this->phones = Category::factory()->create(['name' => 'Phones', 'slug' => 'phones', 'parent_id' => $this->electronics->id]);
    }

    private function product(array $attrs = [], ?Store $store = null): Product
    {
        $p = Product::factory()->published()->create(['store_id' => ($store ?? $this->store)->id, 'category_id' => $this->phones->id, ...$attrs]);
        ProductImage::factory()->for($p)->create();

        return $p;
    }

    public function test_only_published_products_of_active_stores_are_listed(): void
    {
        $visible = $this->product(['name' => 'Visible phone']);
        Product::factory()->create(['store_id' => $this->store->id]); // draft
        Product::factory()->pendingReview()->create(['store_id' => $this->store->id]);
        $this->product([], Store::factory()->suspended()->create());
        $this->product([], Store::factory()->create()); // pending store
        $this->product()->delete(); // soft-deleted

        $this->getJson('/api/v1/products')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $visible->id)
            ->assertJsonPath('data.0.store.slug', 'atlas')
            ->assertJsonPath('meta.total', 1);
    }

    public function test_minimum_price_never_appears_in_public_responses(): void
    {
        $p = $this->product(['price' => 1000, 'allow_negotiation' => true, 'minimum_price' => 777.77]);

        foreach (['/api/v1/products', "/api/v1/products/{$p->slug}", "/api/v1/products/{$p->slug}/related", '/api/v1/home', '/api/v1/search?q='.urlencode($p->name), '/api/v1/stores/atlas'] as $url) {
            $body = $this->getJson($url)->assertOk()->getContent();
            $this->assertStringNotContainsString('minimum_price', $body, $url);
            $this->assertStringNotContainsString('777.77', $body, $url);
        }
    }

    public function test_filters_search_and_sorting(): void
    {
        $cheap = $this->product(['name' => 'Budget Phone', 'price' => 100, 'allow_negotiation' => false, 'stock_quantity' => 0]);
        $mid = $this->product(['name' => 'Galaxy Mid', 'price' => 500, 'allow_negotiation' => true, 'minimum_price' => 400, 'rating_avg' => 4.5, 'sku' => 'GAL-500']);
        $other = Category::factory()->create();
        $exp = $this->product(['name' => 'Laptop Pro', 'price' => 9000, 'category_id' => $other->id, 'sales_count' => 50]);

        $ids = fn ($url) => collect($this->getJson($url)->assertOk()->json('data'))->pluck('id')->all();

        $this->assertSame([$mid->id], $ids('/api/v1/products?q=galaxy'));
        $this->assertSame([$mid->id], $ids('/api/v1/products?q=GAL-500'), 'SKU search');
        $this->assertEqualsCanonicalizing([$cheap->id, $mid->id], $ids('/api/v1/products?category=electronics'), 'parent category includes children');
        $this->assertSame([$mid->id], $ids('/api/v1/products?negotiable=1'));
        $this->assertSame([$mid->id], $ids('/api/v1/products?min_price=200&max_price=1000'));
        $this->assertSame([$mid->id], $ids('/api/v1/products?min_rating=4'));
        $this->assertNotContains($cheap->id, $ids('/api/v1/products?in_stock=1'));
        $this->assertSame([$cheap->id, $mid->id, $exp->id], $ids('/api/v1/products?sort=price_asc'));
        $this->assertSame([$exp->id, $mid->id, $cheap->id], $ids('/api/v1/products?sort=price_desc'));
        $this->assertSame($exp->id, $ids('/api/v1/products?sort=popular')[0]);
        $this->assertSame([$exp->id], $ids('/api/v1/products?store=atlas&category='.$other->slug));
    }

    public function test_pagination_and_filter_validation(): void
    {
        foreach (range(1, 5) as $i) {
            $this->product();
        }

        $this->getJson('/api/v1/products?per_page=2&page=2')
            ->assertOk()->assertJsonCount(2, 'data')
            ->assertJsonPath('meta.current_page', 2)->assertJsonPath('meta.last_page', 3)->assertJsonPath('meta.total', 5);

        $this->getJson('/api/v1/products?sort=hack&min_price=-1&per_page=500')
            ->assertUnprocessable()->assertJsonValidationErrors(['sort', 'min_price', 'per_page']);
        $this->getJson('/api/v1/products?min_price=500&max_price=100')->assertJsonValidationErrors('max_price');
        $this->getJson('/api/v1/products?q='.urlencode("%' OR 1=1 --"))->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_product_details_with_variants_and_rating_breakdown(): void
    {
        $p = $this->product(['price' => 300]);
        ProductVariant::factory()->for($p)->create(['attributes' => ['color' => 'Black', 'size' => 'M'], 'price' => 280, 'stock_quantity' => 3]);
        ProductVariant::factory()->for($p)->create(['attributes' => ['color' => 'Sand', 'size' => 'L'], 'stock_quantity' => 0]);
        ProductVariant::factory()->for($p)->create(['attributes' => ['color' => 'Red', 'size' => 'S'], 'status' => 'inactive']);

        $this->getJson("/api/v1/products/{$p->slug}")
            ->assertOk()
            ->assertJsonPath('data.id', $p->id)
            ->assertJsonCount(2, 'data.variants')
            ->assertJsonPath('data.variants.0.price', 280)
            ->assertJsonPath('data.variants.1.price', 300)
            ->assertJsonPath('data.variants.1.in_stock', false)
            ->assertJsonPath('data.variant_options.color', ['Black', 'Sand'])
            ->assertJsonPath('data.category.parent.slug', 'electronics')
            ->assertJsonPath('data.store.slug', 'atlas')
            ->assertJsonPath('meta.rating_breakdown.5', 0);

        $this->getJson('/api/v1/products')->assertJsonPath('data.0.price_from', 280)->assertJsonPath('data.0.has_variants', true);
    }

    public function test_hidden_products_return_404(): void
    {
        $draft = Product::factory()->create(['store_id' => $this->store->id]);

        $this->getJson("/api/v1/products/{$draft->slug}")->assertNotFound()->assertJsonPath('success', false);
        $this->getJson('/api/v1/products/does-not-exist')->assertNotFound();
    }

    public function test_related_products_and_public_reviews(): void
    {
        $p = $this->product();
        $sameCategory = $this->product();
        $sameStore = $this->product(['category_id' => Category::factory()->create()->id]);
        $unrelated = $this->product(['category_id' => Category::factory()->create()->id], Store::factory()->active()->create());

        $related = collect($this->getJson("/api/v1/products/{$p->slug}/related")->json('data'))->pluck('id');
        $this->assertSame([$sameCategory->id, $sameStore->id], $related->all());
        $this->assertNotContains($unrelated->id, $related);

        $review = ProductReview::factory()->create(['product_id' => $p->id, 'status' => ReviewStatus::Approved, 'comment' => 'Great!']);
        ProductReview::factory()->create(['product_id' => $p->id, 'status' => ReviewStatus::Pending]);
        $review->author->forceFill(['name' => 'Salma Bennani'])->save();

        $this->getJson("/api/v1/products/{$p->id}/reviews")
            ->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.author', 'Salma B.')
            ->assertJsonMissingPath('data.0.user_id');
    }

    public function test_categories_tree_counts_and_category_detail(): void
    {
        $this->product();
        $this->product();
        Category::factory()->create(['status' => 'inactive', 'parent_id' => $this->electronics->id]);

        $this->getJson('/api/v1/categories')
            ->assertOk()
            ->assertJsonPath('data.0.slug', 'electronics')
            ->assertJsonPath('data.0.products_count', 2)
            ->assertJsonCount(1, 'data.0.children')
            ->assertJsonPath('data.0.children.0.products_count', 2);

        $this->getJson('/api/v1/categories/phones')->assertOk()->assertJsonPath('data.parent.slug', 'electronics');

        // Regression: the cached (second) response must be identical, with children as a plain list.
        // Serialise array-cache values like a real cache store would.
        config(['cache.stores.array.serialize' => true]);
        Cache::forgetDriver('array');
        $first = $this->getJson('/api/v1/categories')->json('data');
        $cached = $this->getJson('/api/v1/categories')->json('data');
        $this->assertSame($first, $cached);
        $this->assertTrue(array_is_list($cached[0]['children']));
        $this->assertSame('phones', $cached[0]['children'][0]['slug']);
    }

    public function test_store_directory_and_profile(): void
    {
        $this->product(['allow_negotiation' => true, 'minimum_price' => 10]);
        Store::factory()->suspended()->create(['name' => 'Hidden Shop']);

        $this->getJson('/api/v1/stores')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('meta.cities', [$this->store->city]);
        $this->getJson('/api/v1/stores?q=atl')->assertJsonCount(1, 'data');
        $this->getJson('/api/v1/stores/atlas')
            ->assertOk()
            ->assertJsonPath('data.products_count', 1)
            ->assertJsonPath('data.negotiable_products_count', 1)
            ->assertJsonMissingPath('data.user_id')
            ->assertJsonMissingPath('data.phone');

        $suspended = Store::where('name', 'Hidden Shop')->first();
        $this->getJson("/api/v1/stores/{$suspended->slug}")->assertNotFound();
    }

    public function test_home_sections_use_real_data_and_cache_is_invalidated_on_change(): void
    {
        $featured = $this->product(['featured' => true]);

        $this->getJson('/api/v1/home')
            ->assertOk()
            ->assertJsonPath('data.stats.products', 1)
            ->assertJsonPath('data.featured.0.id', $featured->id)
            ->assertJsonStructure(['data' => ['categories', 'featured', 'latest', 'popular', 'negotiable', 'stores']]);

        $second = $this->product(['name' => 'Brand new']);
        $this->getJson('/api/v1/home')->assertJsonPath('data.stats.products', 2)->assertJsonPath('data.latest.0.id', $second->id);
    }

    public function test_search_suggestions(): void
    {
        $this->product(['name' => 'Leather Bag']);

        $this->getJson('/api/v1/search?q=leath')->assertOk()->assertJsonCount(1, 'data.products');
        $this->getJson('/api/v1/search?q=a')->assertUnprocessable();
    }
}
