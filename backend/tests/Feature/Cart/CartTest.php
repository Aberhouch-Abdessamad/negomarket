<?php

namespace Tests\Feature\Cart;

use App\Models\CartItem;
use App\Models\Category;
use App\Models\Negotiation;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use App\Services\Negotiation\NegotiationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\Concerns\ActsAsSpa;
use Tests\Concerns\BuildsNegotiations;
use Tests\TestCase;

class CartTest extends TestCase
{
    use ActsAsSpa, BuildsNegotiations, RefreshDatabase;

    private User $seller;

    private User $customer;

    private Product $product;

    protected function setUp(): void
    {
        parent::setUp();
        Notification::fake();
        $this->seller = $this->sellerWithStore();
        $this->customer = $this->customer();
        $this->product = $this->negotiableProduct($this->seller, [
            'price' => 1000,
            'minimum_price' => 700,
            'stock_quantity' => 10,
        ]);
    }

    private function add(array $payload, int $status = 201)
    {
        return $this->actingAs($this->customer)
            ->postJson('/api/v1/cart/items', $payload)
            ->assertStatus($status);
    }

    public function test_cart_requires_authentication(): void
    {
        $this->getJson('/api/v1/cart')->assertUnauthorized();
        $this->postJson('/api/v1/cart/items', ['product_id' => $this->product->id, 'quantity' => 1])
            ->assertUnauthorized();
    }

    public function test_a_customer_adds_updates_and_removes_a_listed_product(): void
    {
        $this->actingAs($this->customer)
            ->getJson('/api/v1/cart')
            ->assertOk()
            ->assertJsonPath('data.item_count', 0)
            ->assertJsonPath('data.total', 0);

        $this->add(['product_id' => $this->product->id, 'quantity' => 2])
            ->assertJsonPath('data.item_count', 1)
            ->assertJsonPath('data.total_quantity', 2)
            ->assertJsonPath('data.subtotal', 2000)
            ->assertJsonPath('data.items.0.product.id', $this->product->id)
            ->assertJsonPath('data.items.0.unit_price', 1000)
            ->assertJsonPath('data.items.0.line_total', 2000)
            ->assertJsonPath('data.items.0.available', true)
            ->assertJsonPath('data.items.0.is_negotiated', false);

        $item = CartItem::query()->firstOrFail();

        $this->actingAs($this->customer)
            ->putJson("/api/v1/cart/items/{$item->id}", ['quantity' => 3])
            ->assertOk()
            ->assertJsonPath('data.total_quantity', 3)
            ->assertJsonPath('data.subtotal', 3000);

        $this->actingAs($this->customer)
            ->deleteJson("/api/v1/cart/items/{$item->id}")
            ->assertOk()
            ->assertJsonPath('data.item_count', 0);

        $this->assertDatabaseCount('cart_items', 0);
    }

    public function test_adding_the_same_line_merges_quantities_and_cannot_exceed_stock(): void
    {
        $this->add(['product_id' => $this->product->id, 'quantity' => 2]);

        $this->add(['product_id' => $this->product->id, 'quantity' => 3])
            ->assertJsonPath('data.item_count', 1)
            ->assertJsonPath('data.total_quantity', 5);

        $this->add(['product_id' => $this->product->id, 'quantity' => 6], 422)
            ->assertJsonValidationErrors('quantity');

        $this->assertSame(5, (int) CartItem::query()->value('quantity'));
    }

    public function test_a_customer_cannot_buy_from_their_own_store(): void
    {
        $this->actingAs($this->seller)
            ->postJson('/api/v1/cart/items', ['product_id' => $this->product->id, 'quantity' => 1])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('product_id');
    }

    public function test_out_of_stock_and_unpublished_products_are_rejected(): void
    {
        $outOfStock = $this->negotiableProduct($this->seller, ['stock_quantity' => 0]);
        $this->add(['product_id' => $outOfStock->id, 'quantity' => 1], 422)
            ->assertJsonValidationErrors('quantity');

        $draft = Product::factory()->for($this->seller->store)->for(Category::factory())->create([
            'price' => 100,
            'stock_quantity' => 5,
        ]);
        $this->add(['product_id' => $draft->id, 'quantity' => 1], 422)
            ->assertJsonValidationErrors('product_id');
    }

    public function test_a_variant_is_required_and_its_price_is_used(): void
    {
        $product = Product::factory()->published()->for($this->seller->store)->for(Category::factory())->create([
            'price' => 500,
            'stock_quantity' => 0,
        ]);
        $variant = ProductVariant::factory()->for($product)->create([
            'price' => 550,
            'stock_quantity' => 4,
        ]);

        $this->add(['product_id' => $product->id, 'quantity' => 1], 422)
            ->assertJsonValidationErrors('product_variant_id');

        $this->add(['product_id' => $product->id, 'product_variant_id' => $variant->id, 'quantity' => 2])
            ->assertJsonPath('data.items.0.unit_price', 550)
            ->assertJsonPath('data.items.0.line_total', 1100)
            ->assertJsonPath('data.items.0.variant.id', $variant->id);
    }

    public function test_a_cart_item_belongs_to_one_customer_only(): void
    {
        $this->add(['product_id' => $this->product->id, 'quantity' => 1]);
        $item = CartItem::query()->firstOrFail();

        $other = $this->customer();

        $this->actingAs($other)
            ->putJson("/api/v1/cart/items/{$item->id}", ['quantity' => 2])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('cart');

        $this->actingAs($other)
            ->deleteJson("/api/v1/cart/items/{$item->id}")
            ->assertUnprocessable()
            ->assertJsonValidationErrors('cart');

        $this->assertSame(1, (int) $item->fresh()->quantity);
    }

    public function test_an_accepted_negotiation_uses_the_agreed_price_and_quantity(): void
    {
        $negotiation = $this->acceptedNegotiation(850, 2);

        $this->add(['negotiation_id' => $negotiation->id])
            ->assertJsonPath('data.items.0.is_negotiated', true)
            ->assertJsonPath('data.items.0.negotiation_id', $negotiation->id)
            ->assertJsonPath('data.items.0.quantity', 2)
            ->assertJsonPath('data.items.0.unit_price', 850)
            ->assertJsonPath('data.items.0.original_price', 1000)
            ->assertJsonPath('data.items.0.line_total', 1700);

        $item = CartItem::query()->firstOrFail();

        // Negotiated lines keep the quantity agreed with the seller.
        $this->actingAs($this->customer)
            ->putJson("/api/v1/cart/items/{$item->id}", ['quantity' => 3])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('quantity');

        $this->assertSame(2, (int) $item->fresh()->quantity);
    }

    public function test_an_unaccepted_negotiation_cannot_be_added_to_the_cart(): void
    {
        $negotiation = app(NegotiationService::class)->startNegotiation($this->customer, [
            'product_id' => $this->product->id,
            'quantity' => 1,
            'amount' => 850,
        ]);

        $this->add(['negotiation_id' => $negotiation->id], 422)
            ->assertJsonValidationErrors('negotiation_id');

        $other = $this->customer();
        $accepted = $this->acceptedNegotiation(850, 1, $this->negotiableProduct($this->seller));

        $this->actingAs($other)
            ->postJson('/api/v1/cart/items', ['negotiation_id' => $accepted->id])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('negotiation_id');
    }

    private function acceptedNegotiation(float $amount, int $quantity, ?Product $product = null): Negotiation
    {
        $service = app(NegotiationService::class);
        $negotiation = $service->startNegotiation($this->customer, [
            'product_id' => ($product ?? $this->product)->id,
            'quantity' => $quantity,
            'amount' => $amount,
        ]);

        $service->acceptOffer($this->seller, $negotiation->fresh(), $negotiation->offers()->firstOrFail());

        return $negotiation->fresh();
    }
}
