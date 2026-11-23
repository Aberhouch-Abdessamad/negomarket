<?php

namespace Tests\Feature\Seller;

use App\Enums\InventoryMovementType;
use App\Enums\ProductStatus;
use App\Models\Category;
use App\Models\InventoryMovement;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\ProductImage;
use App\Models\Setting;
use App\Models\Store;
use App\Models\User;
use App\Notifications\Catalog\ProductModerationNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Tests\Concerns\ActsAsSpa;
use Tests\Concerns\MakesImages;
use Tests\TestCase;

class SellerProductTest extends TestCase
{
    use ActsAsSpa, MakesImages, RefreshDatabase;

    private User $seller;

    private Category $category;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
        $this->seller = $this->sellerWithStore();
        $this->category = Category::factory()->create();
    }

    private function sellerWithStore(string $state = 'active'): User
    {
        $user = $this->customer();
        $user->assignRole('seller');
        Store::factory()->{$state}()->for($user, 'owner')->create();

        return $user->fresh();
    }

    private function payload(array $overrides = []): array
    {
        return array_merge([
            'name' => 'Handmade Leather Bag',
            'sku' => 'bag-001',
            'category_id' => $this->category->id,
            'description' => 'Full-grain leather.',
            'price' => 1200,
            'allow_negotiation' => true,
            'minimum_price' => 950,
            'stock_quantity' => 7,
        ], $overrides);
    }

    public function test_seller_creates_a_draft_product_with_stock_in_the_ledger(): void
    {
        $response = $this->actingAs($this->seller)->postJson('/api/v1/seller/products', $this->payload(['store_id' => 999, 'status' => 'published', 'featured' => true]))
            ->assertCreated()
            ->assertJsonPath('data.status', 'draft')
            ->assertJsonPath('data.sku', 'BAG-001')
            ->assertJsonPath('data.minimum_price', 950)
            ->assertJsonPath('data.stock_quantity', 7)
            ->assertJsonPath('data.featured', false);

        $product = Product::findOrFail($response->json('data.id'));
        $this->assertSame($this->seller->store->id, $product->store_id, 'store comes from the session, not the payload');
        $this->assertDatabaseHas(InventoryMovement::class, ['product_id' => $product->id, 'type' => InventoryMovementType::Initial->value, 'quantity_change' => 7, 'quantity_after' => 7]);
    }

    public function test_business_rules_for_pricing_and_negotiation(): void
    {
        $this->actingAs($this->seller);

        $this->postJson('/api/v1/seller/products', $this->payload(['minimum_price' => 1500]))
            ->assertJsonValidationErrors(['minimum_price' => 'less than or equal to the listed price']);
        $this->postJson('/api/v1/seller/products', $this->payload(['minimum_price' => null]))
            ->assertJsonValidationErrors(['minimum_price' => 'Set your minimum acceptable price']);
        $this->postJson('/api/v1/seller/products', $this->payload(['price' => 0, 'stock_quantity' => -1, 'sku' => 'bad sku!']))
            ->assertJsonValidationErrors(['price', 'stock_quantity', 'sku']);

        // Negotiation off: minimum price is discarded.
        $id = $this->postJson('/api/v1/seller/products', $this->payload(['allow_negotiation' => false, 'minimum_price' => 5]))->assertCreated()->json('data.id');
        $this->assertNull(Product::find($id)->minimum_price);
    }

    public function test_sku_is_unique_per_store_only(): void
    {
        $this->actingAs($this->seller)->postJson('/api/v1/seller/products', $this->payload())->assertCreated();
        $this->actingAs($this->seller)->postJson('/api/v1/seller/products', $this->payload())->assertJsonValidationErrors('sku');

        $other = $this->sellerWithStore();
        $this->actingAs($other)->postJson('/api/v1/seller/products', $this->payload())->assertCreated();
    }

    public function test_variants_drive_stock_and_validate_consistency(): void
    {
        $this->actingAs($this->seller);
        $payload = $this->payload(['stock_quantity' => null, 'minimum_price' => 900, 'variants' => [
            ['sku' => 'bag-001-blk', 'attributes' => ['color' => 'Black'], 'stock_quantity' => 3],
            ['sku' => 'bag-001-tan', 'attributes' => ['color' => 'Tan'], 'price' => 1300, 'stock_quantity' => 2],
        ]]);
        unset($payload['stock_quantity']);

        $id = $this->postJson('/api/v1/seller/products', $payload)->assertCreated()
            ->assertJsonPath('data.stock_quantity', 5)->assertJsonCount(2, 'data.variants')->json('data.id');

        // Update: change one level, drop one variant, add another.
        $product = Product::with('variants')->find($id);
        $black = $product->variants->firstWhere('sku', 'BAG-001-BLK');
        $update = [...$payload, 'variants' => [
            ['id' => $black->id, 'sku' => 'bag-001-blk', 'attributes' => ['color' => 'Black'], 'stock_quantity' => 10],
            ['sku' => 'bag-001-red', 'attributes' => ['color' => 'Red'], 'stock_quantity' => 1],
        ]];
        $this->putJson("/api/v1/seller/products/{$id}", $update)->assertOk()->assertJsonPath('data.stock_quantity', 11)->assertJsonCount(2, 'data.variants');

        $this->assertSame(11, (int) InventoryMovement::where('product_id', $id)->sum('quantity_change'), 'ledger matches stock');

        $this->putJson("/api/v1/seller/products/{$id}", [...$payload, 'variants' => [
            ['sku' => 'a', 'attributes' => ['color' => 'Black'], 'stock_quantity' => 1],
            ['sku' => 'b', 'attributes' => ['size' => 'M'], 'stock_quantity' => 1],
        ]])->assertJsonValidationErrors('variants.1.attributes');

        $this->putJson("/api/v1/seller/products/{$id}", [...$payload, 'minimum_price' => 1000, 'variants' => [
            ['sku' => 'a', 'attributes' => ['color' => 'Black'], 'price' => 950, 'stock_quantity' => 1],
        ]])->assertJsonValidationErrors('minimum_price');
    }

    public function test_sellers_cannot_see_or_modify_other_stores_products(): void
    {
        $theirs = Product::factory()->create(['store_id' => $this->sellerWithStore()->store->id]);
        $this->actingAs($this->seller);

        $this->getJson("/api/v1/seller/products/{$theirs->id}")->assertForbidden();
        $this->putJson("/api/v1/seller/products/{$theirs->id}", $this->payload())->assertForbidden();
        $this->deleteJson("/api/v1/seller/products/{$theirs->id}")->assertForbidden();
        $this->postJson("/api/v1/seller/products/{$theirs->id}/publish")->assertForbidden();
        $this->postJson("/api/v1/seller/products/{$theirs->id}/images", ['images' => [$this->image('a.jpg', 400, 400)]])->assertForbidden();
        $this->getJson('/api/v1/seller/products')->assertJsonCount(0, 'data');
    }

    public function test_only_approved_sellers_reach_the_seller_api(): void
    {
        $this->actingAs($this->customer())->getJson('/api/v1/seller/products')->assertForbidden();
        $this->actingAs($this->sellerWithStore('suspended'))->postJson('/api/v1/seller/products', $this->payload())->assertForbidden();

        // E-mail verification is not required: an active store is enough.
        $unverified = $this->sellerWithStore();
        $unverified->forceFill(['email_verified_at' => null])->save();
        $this->actingAs($unverified)->getJson('/api/v1/seller/products')->assertOk();

        $this->actingAs($this->customer())->getJson('/api/v1/seller/products')->assertForbidden();
    }

    public function test_image_upload_is_optimised_validated_and_limited(): void
    {
        $id = $this->actingAs($this->seller)->postJson('/api/v1/seller/products', $this->payload())->json('data.id');

        $res = $this->post("/api/v1/seller/products/{$id}/images", ['images' => [
            $this->image('one.jpg', 2400, 1800),
            $this->image('two.png', 500, 500),
        ]])->assertCreated()->assertJsonCount(2, 'data.images');

        $image = ProductImage::where('product_id', $id)->orderBy('sort_order')->first();
        $gd = extension_loaded('gd') && function_exists('imagewebp');
        $this->assertStringEndsWith($gd ? '.webp' : '.jpg', $image->image_path);
        Storage::disk('public')->assertExists($image->image_path);
        if ($gd) {
            Storage::disk('public')->assertExists($image->thumbnail_path);
        }
        [$w] = getimagesizefromstring(Storage::disk('public')->get($image->image_path));
        $this->assertSame($gd ? 1600 : 2400, $w, $gd ? 'resized to max 1600px' : 'original kept when GD is unavailable');

        foreach ([
            UploadedFile::fake()->create('x.svg', 10, 'image/svg+xml'),
            UploadedFile::fake()->create('x.php', 10, 'text/x-php'),
            $this->image('small.jpg', 100, 100),
        ] as $bad) {
            $this->post("/api/v1/seller/products/{$id}/images", ['images' => [$bad]])->assertJsonValidationErrors('images.0');
        }

        $six = array_map(fn ($i) => $this->image("i{$i}.jpg", 400, 400), range(1, 7));
        $this->post("/api/v1/seller/products/{$id}/images", ['images' => $six])->assertJsonValidationErrors('images');

        $ids = collect($res->json('data.images'))->pluck('id')->reverse()->values()->all();
        $this->patchJson("/api/v1/seller/products/{$id}/images/order", ['image_ids' => $ids])->assertOk()->assertJsonPath('data.images.0.id', $ids[0]);

        $this->deleteJson("/api/v1/seller/products/{$id}/images/{$image->id}")->assertOk()->assertJsonCount(1, 'data.images');
        Storage::disk('public')->assertMissing($image->image_path);
    }

    public function test_publish_flow_with_moderation_and_admin_decisions(): void
    {
        Notification::fake();
        $id = $this->actingAs($this->seller)->postJson('/api/v1/seller/products', $this->payload())->json('data.id');

        $this->postJson("/api/v1/seller/products/{$id}/publish")->assertJsonValidationErrors('images');
        ProductImage::factory()->create(['product_id' => $id]);

        $this->postJson("/api/v1/seller/products/{$id}/publish")->assertOk()->assertJsonPath('data.status', 'pending_review');
        $this->getJson('/api/v1/products')->assertJsonCount(0, 'data');

        $admin = $this->customer();
        $admin->assignRole('admin');
        $this->actingAs($this->seller)->patchJson("/api/v1/admin/products/{$id}/approve")->assertForbidden();

        $this->actingAs($admin)->patchJson("/api/v1/admin/products/{$id}/reject", ['reason' => 'Photos are blurry.'])
            ->assertOk()->assertJsonPath('data.status', 'rejected')->assertJsonPath('data.rejection_reason', 'Photos are blurry.');
        Notification::assertSentTo($this->seller, ProductModerationNotification::class, fn ($n) => ! $n->approved);

        $this->actingAs($this->seller)->postJson("/api/v1/seller/products/{$id}/publish")->assertJsonPath('data.status', 'pending_review');
        $this->actingAs($admin)->patchJson("/api/v1/admin/products/{$id}/approve")->assertOk()->assertJsonPath('data.status', 'published');
        $this->actingAs($admin)->patchJson("/api/v1/admin/products/{$id}/approve")->assertJsonValidationErrors('status');

        $this->getJson('/api/v1/products')->assertJsonCount(1, 'data');
    }

    public function test_publish_without_moderation_goes_live_immediately(): void
    {
        Setting::put('products.require_moderation', false);
        $product = Product::factory()->create(['store_id' => $this->seller->store->id]);
        ProductImage::factory()->for($product)->create();

        $this->actingAs($this->seller)->postJson("/api/v1/seller/products/{$product->id}/publish")
            ->assertOk()->assertJsonPath('data.status', 'published')->assertJsonPath('message', 'Product published.');
        $this->postJson("/api/v1/seller/products/{$product->id}/unpublish")->assertJsonPath('data.status', 'draft');
    }

    public function test_delete_soft_deletes_or_archives_when_ordered(): void
    {
        $this->actingAs($this->seller);
        $fresh = Product::factory()->create(['store_id' => $this->seller->store->id]);
        $ordered = Product::factory()->published()->create(['store_id' => $this->seller->store->id]);
        OrderItem::factory()->create(['product_id' => $ordered->id]);

        $this->deleteJson("/api/v1/seller/products/{$fresh->id}")->assertOk()->assertJsonPath('data.result', 'deleted');
        $this->assertSoftDeleted($fresh);

        $this->deleteJson("/api/v1/seller/products/{$ordered->id}")->assertOk()->assertJsonPath('data.result', 'archived');
        $this->assertSame(ProductStatus::Archived, $ordered->fresh()->status);
    }

    public function test_seller_list_filters(): void
    {
        Product::factory()->count(2)->create(['store_id' => $this->seller->store->id, 'stock_quantity' => 0]);
        Product::factory()->published()->create(['store_id' => $this->seller->store->id, 'stock_quantity' => 3, 'name' => 'Zebra rug']);

        $this->actingAs($this->seller)->getJson('/api/v1/seller/products?stock=out')->assertJsonCount(2, 'data');
        $this->getJson('/api/v1/seller/products?stock=low')->assertJsonCount(1, 'data');
        $this->getJson('/api/v1/seller/products?status=published&q=zebra')->assertJsonCount(1, 'data')->assertJsonPath('data.0.minimum_price', null);
    }
}
