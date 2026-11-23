<?php

namespace Tests\Feature\Seller;

use App\Enums\NegotiationStatus;
use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Enums\ReviewStatus;
use App\Models\InventoryMovement;
use App\Models\Negotiation;
use App\Models\NegotiationOffer;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Models\Product;
use App\Models\ProductReview;
use App\Models\ProductVariant;
use App\Models\Store;
use App\Models\StoreAddress;
use App\Models\User;
use App\Services\Inventory\InventoryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\Concerns\ActsAsSpa;
use Tests\Concerns\MakesImages;
use Tests\TestCase;

class StoreManagementTest extends TestCase
{
    use ActsAsSpa, MakesImages, RefreshDatabase;

    private User $seller;

    private Store $store;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
        $this->seller = $this->customer();
        $this->seller->assignRole('seller');
        $this->store = Store::factory()->active()->for($this->seller, 'owner')->create(['name' => 'Atlas']);
        $this->actingAs($this->seller);
    }

    public function test_store_update_rejects_protected_fields_and_saves_allowed_ones(): void
    {
        $this->getJson('/api/v1/seller/store')->assertOk()->assertJsonPath('data.name', 'Atlas')->assertJsonPath('data.status', 'active');

        // Unvalidated keys (slug, status, user_id) are ignored: only validated data is saved.
        $this->putJson('/api/v1/seller/store', ['name' => 'Atlas Pro', 'city' => 'Rabat', 'description' => 'Better', 'phone' => '0522000000', 'slug' => 'hijack', 'status' => 'closed', 'user_id' => 999])
            ->assertOk()->assertJsonPath('data.name', 'Atlas Pro')->assertJsonPath('data.city', 'Rabat');
        $this->assertSame($this->store->slug, $this->store->fresh()->slug);
        $this->assertSame('active', $this->store->fresh()->status->value);
        $this->assertSame($this->seller->id, $this->store->fresh()->user_id);

        $this->post('/api/v1/seller/store/logo', ['image' => $this->image('logo.png', 600, 600)])->assertOk();
        $logo = $this->store->fresh()->logo;
        Storage::disk('public')->assertExists($logo);
        [$w, $h] = getimagesizefromstring(Storage::disk('public')->get($logo));
        $gd = extension_loaded('gd') && function_exists('imagewebp');
        $this->assertSame($gd ? [400, 400] : [600, 600], [$w, $h]);

        $this->post('/api/v1/seller/store/banner', ['image' => $this->image('banner.jpg', 500, 500)])->assertJsonValidationErrors('image');
        $this->post('/api/v1/seller/store/banner', ['image' => $this->image('banner.jpg', 2000, 800)])->assertOk();
        $this->post('/api/v1/seller/store/cover', ['image' => $this->image('x.jpg', 2000, 800)])->assertNotFound();
    }

    public function test_store_addresses_keep_one_default_per_type_and_are_owner_only(): void
    {
        $a = $this->postJson('/api/v1/seller/store/addresses', ['type' => 'pickup', 'address_line1' => 'Zone A', 'city' => 'Casablanca'])
            ->assertCreated()->assertJsonPath('data.is_default', true)->json('data.id');
        $b = $this->postJson('/api/v1/seller/store/addresses', ['type' => 'pickup', 'address_line1' => 'Zone B', 'city' => 'Casablanca', 'is_default' => true])
            ->assertCreated()->json('data.id');
        $this->assertFalse(StoreAddress::find($a)->is_default);
        $this->assertTrue(StoreAddress::find($b)->is_default);

        $this->deleteJson("/api/v1/seller/store/addresses/{$b}")->assertOk();
        $this->assertTrue(StoreAddress::find($a)->is_default);

        $foreign = StoreAddress::factory()->create();
        $this->putJson("/api/v1/seller/store/addresses/{$foreign->id}", ['type' => 'pickup', 'address_line1' => 'x', 'city' => 'y'])->assertForbidden();
        $this->deleteJson("/api/v1/seller/store/addresses/{$foreign->id}")->assertForbidden();
    }

    public function test_inventory_listing_adjustments_and_ledger(): void
    {
        $simple = Product::factory()->create(['store_id' => $this->store->id, 'stock_quantity' => 0, 'name' => 'Simple']);
        app(InventoryService::class)->initial($simple, null, 3);
        $withVariants = Product::factory()->create(['store_id' => $this->store->id, 'stock_quantity' => 0]);
        $variant = ProductVariant::factory()->for($withVariants)->create(['stock_quantity' => 0]);

        $this->getJson('/api/v1/seller/inventory')->assertOk()->assertJsonCount(2, 'data')->assertJsonPath('meta.low_stock_threshold', 5);
        $this->getJson('/api/v1/seller/inventory?stock=low')->assertJsonCount(1, 'data')->assertJsonPath('data.0.name', 'Simple');

        $this->postJson('/api/v1/seller/inventory/adjust', ['product_id' => $simple->id, 'mode' => 'add', 'quantity' => 10, 'note' => 'Delivery from supplier'])
            ->assertOk()->assertJsonPath('data.quantity_after', 13)->assertJsonPath('data.type', 'restock');
        $this->postJson('/api/v1/seller/inventory/adjust', ['product_id' => $simple->id, 'mode' => 'remove', 'quantity' => 20])
            ->assertUnprocessable()->assertJsonValidationErrors('stock_quantity');
        $this->postJson('/api/v1/seller/inventory/adjust', ['product_id' => $simple->id, 'mode' => 'set', 'quantity' => 13])
            ->assertOk()->assertJsonPath('message', 'Stock level unchanged.');

        $this->postJson('/api/v1/seller/inventory/adjust', ['product_id' => $withVariants->id, 'mode' => 'set', 'quantity' => 4])
            ->assertJsonValidationErrors('product_variant_id');
        $this->postJson('/api/v1/seller/inventory/adjust', ['product_id' => $withVariants->id, 'product_variant_id' => $variant->id, 'mode' => 'set', 'quantity' => 4])->assertOk();
        $this->assertSame(4, $withVariants->fresh()->stock_quantity);

        $this->getJson("/api/v1/seller/inventory/movements?product_id={$simple->id}")->assertOk()->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.note', 'Delivery from supplier')->assertJsonPath('data.0.actor', $this->seller->name);

        $foreign = Product::factory()->create();
        $this->postJson('/api/v1/seller/inventory/adjust', ['product_id' => $foreign->id, 'mode' => 'add', 'quantity' => 1])->assertForbidden();
        $this->assertSame(0, InventoryMovement::where('product_id', $foreign->id)->count());
        $this->getJson("/api/v1/seller/inventory/movements?product_id={$foreign->id}")->assertJsonCount(0, 'data');
    }

    public function test_dashboard_and_analytics_use_real_store_scoped_data(): void
    {
        $product = Product::factory()->published()->create(['store_id' => $this->store->id, 'stock_quantity' => 2, 'views_count' => 40]);
        Product::factory()->pendingReview()->create(['store_id' => $this->store->id, 'stock_quantity' => 0, 'views_count' => 2]);

        $mk = function (OrderStatus $status, float $total, PaymentStatus $pay = PaymentStatus::Unpaid, ?Store $store = null) use ($product) {
            $order = Order::factory()->status($status)->create(['store_id' => ($store ?? $this->store)->id, 'subtotal' => $total, 'total_amount' => $total]);
            OrderItem::factory()->for($order)->create(['product_id' => $product->id, 'quantity' => 2, 'original_price' => $total / 2, 'unit_price' => $total / 2, 'total_price' => $total]);
            Payment::factory()->for($order)->create(['status' => $pay, 'amount' => $total, 'collected_at' => $pay === PaymentStatus::Collected ? now() : null]);

            return $order;
        };
        $mk(OrderStatus::Pending, 100);
        $mk(OrderStatus::Delivered, 300);
        $mk(OrderStatus::Delivered, 200, PaymentStatus::Collected);
        $mk(OrderStatus::Cancelled, 999);
        $mk(OrderStatus::Delivered, 5000, PaymentStatus::Unpaid, Store::factory()->active()->create()); // other store

        $negotiation = Negotiation::factory()->forProduct($product)->create();
        NegotiationOffer::factory()->for($negotiation)->create();

        $this->getJson('/api/v1/seller/dashboard')
            ->assertOk()
            ->assertJsonPath('data.kpis.revenue_30d', 600)
            ->assertJsonPath('data.kpis.orders_30d', 3)
            ->assertJsonPath('data.kpis.pending_orders', 1)
            ->assertJsonPath('data.kpis.cod_to_collect', 300)
            ->assertJsonPath('data.kpis.cod_collected_30d', 200)
            ->assertJsonPath('data.kpis.active_negotiations', 1)
            ->assertJsonPath('data.kpis.offers_awaiting_reply', 1)
            ->assertJsonPath('data.kpis.product_views', 42)
            ->assertJsonPath('data.products.by_status.published', 1)
            ->assertJsonPath('data.products.by_status.pending_review', 1)
            ->assertJsonPath('data.products.low_stock', 1)
            ->assertJsonPath('data.products.out_of_stock', 1)
            ->assertJsonPath('data.kpis.rating_avg', 0)
            ->assertJsonCount(30, 'data.sales_last_30_days');
    }

    public function test_analytics_periods_and_review_replies(): void
    {
        $product = Product::factory()->published()->create(['store_id' => $this->store->id]);
        $order = Order::factory()->status(OrderStatus::Delivered)->create(['store_id' => $this->store->id, 'subtotal' => 900, 'total_amount' => 900]);
        $negotiation = Negotiation::factory()->forProduct($product)->status(NegotiationStatus::ConvertedToOrder)->create();
        OrderItem::factory()->for($order)->create(['product_id' => $product->id, 'negotiation_id' => $negotiation->id, 'quantity' => 1, 'original_price' => 1000, 'unit_price' => 900, 'total_price' => 900]);
        Negotiation::factory()->forProduct($product)->status(NegotiationStatus::Rejected)->create();

        $this->getJson('/api/v1/seller/analytics?period=7')->assertOk()
            ->assertJsonCount(7, 'data.series')
            ->assertJsonPath('data.totals.revenue', 900)
            ->assertJsonPath('data.top_products.0.negotiated_lines', 1)
            ->assertJsonPath('data.negotiations.total', 2)
            ->assertJsonPath('data.negotiations.conversion_rate', 50)
            ->assertJsonPath('data.negotiations.average_discount_percent', 10);
        $this->getJson('/api/v1/seller/analytics?period=365')->assertJsonValidationErrors('period');

        $review = ProductReview::factory()->create(['product_id' => $product->id, 'status' => ReviewStatus::Approved]);
        $this->getJson('/api/v1/seller/reviews?replied=no')->assertJsonCount(1, 'data');
        $this->postJson("/api/v1/seller/reviews/{$review->id}/reply", ['reply' => 'Thank you!'])->assertOk()->assertJsonPath('data.seller_reply', 'Thank you!');
        $this->getJson('/api/v1/seller/reviews?replied=no')->assertJsonCount(0, 'data');

        $foreign = ProductReview::factory()->create();
        $this->postJson("/api/v1/seller/reviews/{$foreign->id}/reply", ['reply' => 'Hi'])->assertForbidden();
    }
}
