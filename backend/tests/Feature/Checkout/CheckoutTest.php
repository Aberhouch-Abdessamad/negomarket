<?php

namespace Tests\Feature\Checkout;

use App\Enums\NegotiationStatus;
use App\Enums\ProductStatus;
use App\Models\Cart;
use App\Models\CartItem;
use App\Models\OrderGroup;
use App\Models\Product;
use App\Models\User;
use App\Models\UserAddress;
use App\Notifications\Order\OrderPlacedNotification;
use App\Services\Negotiation\NegotiationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\Concerns\ActsAsSpa;
use Tests\Concerns\BuildsNegotiations;
use Tests\TestCase;

class CheckoutTest extends TestCase
{
    use ActsAsSpa, BuildsNegotiations, RefreshDatabase;

    private User $sellerOne;

    private User $sellerTwo;

    private User $customer;

    private Product $productA;

    private Product $productB;

    private Product $productC;

    private UserAddress $address;

    protected function setUp(): void
    {
        parent::setUp();
        Notification::fake();

        $this->sellerOne = $this->sellerWithStore();
        $this->sellerTwo = $this->sellerWithStore();
        $this->customer = $this->customer();

        $this->productA = $this->negotiableProduct($this->sellerOne, ['price' => 1000, 'stock_quantity' => 10]);
        $this->productB = $this->negotiableProduct($this->sellerOne, ['price' => 2000, 'stock_quantity' => 10]);
        $this->productC = $this->negotiableProduct($this->sellerTwo, ['price' => 3000, 'stock_quantity' => 10]);
        $this->address = UserAddress::factory()->for($this->customer)->default()->create();
    }

    private function addToCart(Product $product, int $quantity = 1): void
    {
        $this->actingAs($this->customer)
            ->postJson('/api/v1/cart/items', ['product_id' => $product->id, 'quantity' => $quantity])
            ->assertCreated();
    }

    private function place(array $payload, string $key = 'checkout-key-1')
    {
        return $this->actingAs($this->customer)
            ->withHeader('Idempotency-Key', $key)
            ->postJson('/api/v1/checkout', $payload);
    }

    public function test_preview_prices_a_multi_vendor_cart_without_writing_anything(): void
    {
        $this->addToCart($this->productA, 2);
        $this->addToCart($this->productB);
        $this->addToCart($this->productC);

        $this->actingAs($this->customer)
            ->postJson('/api/v1/checkout/preview', ['address_id' => $this->address->id])
            ->assertOk()
            ->assertJsonPath('data.summary.subtotal', 7000)
            ->assertJsonPath('data.summary.shipping_total', 0)
            ->assertJsonPath('data.summary.total', 7000)
            ->assertJsonPath('data.summary.payment_method', 'cod')
            ->assertJsonPath('data.address.full_name', $this->address->full_name)
            ->assertJsonCount(2, 'data.groups')
            ->assertJsonCount(3, 'data.lines');

        $this->assertDatabaseCount('order_groups', 0);
        $this->assertDatabaseCount('orders', 0);
        $this->assertDatabaseCount('order_items', 0);
        $this->assertDatabaseCount('inventory_movements', 0);
        $this->assertSame(3, CartItem::query()->count());
        $this->assertSame(10, $this->productA->fresh()->stock_quantity);
    }

    public function test_one_checkout_creates_one_group_with_one_order_per_store(): void
    {
        $this->addToCart($this->productA, 2);
        $this->addToCart($this->productB);
        $this->addToCart($this->productC);

        $response = $this->place(['address_id' => $this->address->id])
            ->assertCreated()
            ->assertJsonPath('data.status', 'pending')
            ->assertJsonPath('data.payment_method', 'cod')
            ->assertJsonPath('data.subtotal', 7000)
            ->assertJsonPath('data.total_amount', 7000)
            ->assertJsonPath('data.order_count', 2)
            ->assertJsonCount(2, 'data.orders')
            ->assertJsonPath('data.orders.0.store.id', $this->sellerOne->store->id)
            ->assertJsonPath('data.orders.0.subtotal', 4000)
            ->assertJsonCount(2, 'data.orders.0.items')
            ->assertJsonPath('data.orders.1.store.id', $this->sellerTwo->store->id)
            ->assertJsonPath('data.orders.1.subtotal', 3000)
            ->assertJsonCount(1, 'data.orders.1.items')
            ->assertJsonPath('data.orders.0.status', 'pending')
            ->assertJsonPath('data.orders.0.payment.method', 'cod')
            ->assertJsonPath('data.orders.0.payment.status', 'unpaid')
            ->assertJsonPath('data.orders.0.payment.amount', 4000)
            ->assertJsonPath('data.orders.0.address.city', $this->address->city)
            ->assertJsonPath('data.orders.0.status_history.0.to_status', 'pending');

        $group = OrderGroup::query()->findOrFail($response->json('data.id'));
        $this->assertSame($this->customer->id, $group->customer_id);

        $this->assertDatabaseCount('order_groups', 1);
        $this->assertDatabaseCount('orders', 2);
        $this->assertDatabaseCount('order_items', 3);
        $this->assertDatabaseCount('order_addresses', 2);
        $this->assertDatabaseCount('payments', 2);
        $this->assertDatabaseCount('order_status_histories', 2);
        $this->assertDatabaseCount('cart_items', 0);
        $this->assertDatabaseCount('inventory_movements', 3);
        $this->assertDatabaseHas('inventory_movements', ['type' => 'sale', 'quantity_change' => -2]);

        $this->assertSame(8, $this->productA->fresh()->stock_quantity);
        $this->assertSame(9, $this->productB->fresh()->stock_quantity);
        $this->assertSame(9, $this->productC->fresh()->stock_quantity);

        $this->assertDatabaseHas('activity_logs', [
            'action' => 'order.placed',
            'subject_id' => $group->id,
            'subject_type' => OrderGroup::class,
        ]);

        Notification::assertSentTo($this->sellerOne, OrderPlacedNotification::class);
        Notification::assertSentTo($this->sellerTwo, OrderPlacedNotification::class);
    }

    public function test_repeating_the_same_idempotency_key_returns_the_same_order_without_side_effects(): void
    {
        $this->addToCart($this->productA, 2);

        $first = $this->place(['address_id' => $this->address->id], 'same-key')
            ->assertCreated();

        $second = $this->place(['address_id' => $this->address->id], 'same-key')
            ->assertOk()
            ->assertJsonPath('data.id', $first->json('data.id'));

        $this->assertSame($first->json('data.reference_number'), $second->json('data.reference_number'));
        $this->assertDatabaseCount('order_groups', 1);
        $this->assertDatabaseCount('orders', 1);
        $this->assertDatabaseCount('order_items', 1);
        $this->assertSame(8, $this->productA->fresh()->stock_quantity);
        Notification::assertSentToTimes($this->sellerOne, OrderPlacedNotification::class, 1);
    }

    public function test_a_new_key_cannot_reuse_an_empty_cart(): void
    {
        $this->addToCart($this->productA);
        $this->place(['address_id' => $this->address->id], 'first-key')->assertCreated();

        $this->place(['address_id' => $this->address->id], 'second-key')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('cart');

        $this->assertDatabaseCount('order_groups', 1);
    }

    public function test_an_idempotency_key_header_is_required(): void
    {
        $this->actingAs($this->customer)
            ->postJson('/api/v1/checkout', ['address_id' => $this->address->id])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('idempotency_key');

        $this->assertDatabaseCount('order_groups', 0);
    }

    public function test_client_supplied_prices_and_totals_are_ignored(): void
    {
        $this->addToCart($this->productA);

        $this->place([
            'address_id' => $this->address->id,
            'subtotal' => 1,
            'total_amount' => 1,
            'shipping_total' => -50,
            'items' => [['product_id' => $this->productA->id, 'unit_price' => 1, 'total_price' => 1]],
        ])->assertCreated()
            ->assertJsonPath('data.subtotal', 1000)
            ->assertJsonPath('data.total_amount', 1000)
            ->assertJsonPath('data.orders.0.items.0.unit_price', 1000)
            ->assertJsonPath('data.orders.0.items.0.total_price', 1000);

        $this->assertDatabaseHas('order_items', [
            'product_id' => $this->productA->id,
            'unit_price' => 1000.00,
            'total_price' => 1000.00,
        ]);
    }

    public function test_the_delivery_address_must_belong_to_the_customer(): void
    {
        $this->addToCart($this->productA);
        $foreign = UserAddress::factory()->for($this->customer())->create();

        $this->place(['address_id' => $foreign->id])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('address_id');

        $this->assertDatabaseCount('order_groups', 0);
    }

    public function test_an_address_can_be_provided_inline_and_is_snapshotted(): void
    {
        $this->addToCart($this->productA);

        $this->place([
            'address' => [
                'full_name' => 'Amina Zahra',
                'phone' => '0612345678',
                'address_line1' => '12 Rue Atlas',
                'city' => 'Rabat',
                'country' => 'ma',
            ],
        ])->assertCreated()
            ->assertJsonPath('data.orders.0.address.full_name', 'Amina Zahra')
            ->assertJsonPath('data.orders.0.address.city', 'Rabat')
            ->assertJsonPath('data.orders.0.address.country', 'MA');

        $this->assertDatabaseHas('order_addresses', ['full_name' => 'Amina Zahra', 'country' => 'MA']);
    }

    public function test_stock_is_rechecked_at_checkout(): void
    {
        $this->addToCart($this->productA, 2);
        $this->productA->forceFill(['stock_quantity' => 1])->save();

        $this->place(['address_id' => $this->address->id])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('quantity');

        $this->assertDatabaseCount('order_groups', 0);
        $this->assertSame(1, CartItem::query()->count());
        $this->assertSame(1, $this->productA->fresh()->stock_quantity);
    }

    public function test_a_product_that_is_unpublished_after_being_added_is_rejected(): void
    {
        $this->addToCart($this->productA);
        $this->productA->forceFill(['status' => ProductStatus::Draft])->save();

        $this->place(['address_id' => $this->address->id])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('cart');

        $this->assertDatabaseCount('order_groups', 0);
    }

    public function test_a_cart_line_for_the_customers_own_store_is_rejected_at_checkout(): void
    {
        $this->sellerOne->assignRole('customer');
        $cart = Cart::factory()->for($this->sellerOne)->create();
        CartItem::factory()->for($cart)->for($this->productA)->create(['quantity' => 1]);

        $address = UserAddress::factory()->for($this->sellerOne)->create();

        $this->actingAs($this->sellerOne)
            ->withHeader('Idempotency-Key', 'own-store')
            ->postJson('/api/v1/checkout', ['address_id' => $address->id])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('cart');

        $this->assertDatabaseCount('order_groups', 0);
    }

    public function test_an_accepted_negotiation_can_be_checked_out_at_the_agreed_price(): void
    {
        $negotiation = $this->acceptedNegotiation(850, 2);

        $response = $this->place([
            'address_id' => $this->address->id,
            'negotiation_ids' => [$negotiation->id],
        ], 'negotiation-checkout')->assertCreated()
            ->assertJsonPath('data.orders.0.items.0.is_negotiated', true)
            ->assertJsonPath('data.orders.0.items.0.negotiation_id', $negotiation->id)
            ->assertJsonPath('data.orders.0.items.0.quantity', 2)
            ->assertJsonPath('data.orders.0.items.0.unit_price', 850)
            ->assertJsonPath('data.orders.0.items.0.original_price', 1000)
            ->assertJsonPath('data.orders.0.items.0.total_price', 1700)
            ->assertJsonPath('data.orders.0.total_amount', 1700);

        $orderId = $response->json('data.orders.0.id');

        $negotiation->refresh();
        $this->assertSame(NegotiationStatus::ConvertedToOrder, $negotiation->status);
        $this->assertSame($orderId, $negotiation->converted_order_id);
        $this->assertNotNull($negotiation->closed_at);

        $this->assertDatabaseHas('order_items', [
            'negotiation_id' => $negotiation->id,
            'unit_price' => 850.00,
            'quantity' => 2,
        ]);
        $this->assertSame(8, $this->productA->fresh()->stock_quantity);
        $this->assertDatabaseCount('inventory_movements', 1);
    }

    public function test_an_accepted_negotiation_added_to_the_cart_is_converted_on_checkout(): void
    {
        $negotiation = $this->acceptedNegotiation(900, 1);

        $this->actingAs($this->customer)
            ->postJson('/api/v1/cart/items', ['negotiation_id' => $negotiation->id])
            ->assertCreated();

        $this->place(['address_id' => $this->address->id], 'negotiation-cart')->assertCreated()
            ->assertJsonPath('data.orders.0.items.0.unit_price', 900);

        $this->assertSame(NegotiationStatus::ConvertedToOrder, $negotiation->fresh()->status);
        $this->assertDatabaseCount('cart_items', 0);
    }

    public function test_an_accepted_negotiation_cannot_be_converted_twice(): void
    {
        $negotiation = $this->acceptedNegotiation(850, 1);

        $this->place(['address_id' => $this->address->id, 'negotiation_ids' => [$negotiation->id]], 'once')
            ->assertCreated();

        $this->place(['address_id' => $this->address->id, 'negotiation_ids' => [$negotiation->id]], 'twice')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('negotiation_id');

        $this->assertDatabaseCount('order_items', 1);
        $this->assertDatabaseCount('order_groups', 1);
    }

    public function test_an_expired_accepted_negotiation_cannot_be_checked_out(): void
    {
        $negotiation = $this->acceptedNegotiation(850, 1);
        $negotiation->forceFill(['expires_at' => now()->subMinute()])->save();

        $this->place(['address_id' => $this->address->id, 'negotiation_ids' => [$negotiation->id]])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('negotiation_id');

        $this->assertDatabaseCount('order_groups', 0);
    }

    private function acceptedNegotiation(float $amount, int $quantity): \App\Models\Negotiation
    {
        $service = app(NegotiationService::class);
        $negotiation = $service->startNegotiation($this->customer, [
            'product_id' => $this->productA->id,
            'quantity' => $quantity,
            'amount' => $amount,
        ]);

        $service->acceptOffer($this->sellerOne, $negotiation->fresh(), $negotiation->offers()->firstOrFail());

        return $negotiation->fresh();
    }
}
