<?php

namespace Tests\Feature\Order;

use App\Enums\OrderStatus;
use App\Models\Order;
use App\Models\Product;
use App\Models\Setting;
use App\Models\User;
use App\Notifications\Order\ReviewSubmittedNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\Concerns\ActsAsSpa;
use Tests\Concerns\BuildsNegotiations;
use Tests\Concerns\BuildsOrders;
use Tests\TestCase;

class ReviewTest extends TestCase
{
    use ActsAsSpa, BuildsNegotiations, BuildsOrders, RefreshDatabase;

    private User $seller;

    private User $customer;

    private Product $product;

    protected function setUp(): void
    {
        parent::setUp();
        Notification::fake();

        $this->seller = $this->sellerWithStore();
        $this->customer = $this->customer();
        $this->product = $this->negotiableProduct($this->seller);
    }

    private function deliveredOrder(?User $customer = null): Order
    {
        return $this->makeOrder(
            $customer ?? $this->customer,
            $this->seller->store,
            $this->product,
            OrderStatus::Delivered,
        );
    }

    public function test_a_verified_buyer_review_waits_for_moderation_by_default(): void
    {
        $order = $this->deliveredOrder();

        $this->actingAs($this->customer)
            ->postJson('/api/v1/orders/'.$order->id.'/reviews', [
                'order_item_id' => $order->items()->firstOrFail()->id,
                'rating' => 5,
                'comment' => 'Exactly as described and packed well.',
            ])
            ->assertCreated()
            ->assertJsonPath('data.rating', 5)
            ->assertJsonPath('data.status', 'pending')
            ->assertJsonPath('data.order_item_id', $order->items()->firstOrFail()->id);

        Notification::assertSentTo($this->seller, ReviewSubmittedNotification::class);
    }

    public function test_reviews_are_only_allowed_after_delivery(): void
    {
        $order = $this->makeOrder($this->customer, $this->seller->store, $this->product, OrderStatus::Shipped);

        $this->actingAs($this->customer)
            ->postJson('/api/v1/orders/'.$order->id.'/reviews', [
                'order_item_id' => $order->items()->firstOrFail()->id,
                'rating' => 4,
            ])
            ->assertForbidden();

        $this->assertDatabaseCount('product_reviews', 0);
    }

    public function test_a_customer_cannot_review_someone_elses_order(): void
    {
        $order = $this->deliveredOrder($this->customer());
        $item = $order->items()->firstOrFail();

        $this->actingAs($this->customer)
            ->postJson('/api/v1/orders/'.$order->id.'/reviews', [
                'order_item_id' => $item->id,
                'rating' => 1,
            ])
            ->assertForbidden();
    }

    public function test_each_order_line_can_only_be_reviewed_once(): void
    {
        $order = $this->deliveredOrder();
        $item = $order->items()->firstOrFail();
        $payload = ['order_item_id' => $item->id, 'rating' => 4, 'comment' => 'Good value.'];

        $this->actingAs($this->customer)->postJson('/api/v1/orders/'.$order->id.'/reviews', $payload)->assertCreated();
        $this->actingAs($this->customer)
            ->postJson('/api/v1/orders/'.$order->id.'/reviews', $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors('order_item_id');

        $this->assertDatabaseCount('product_reviews', 1);
    }

    public function test_an_item_from_another_order_is_rejected(): void
    {
        $order = $this->deliveredOrder();
        $otherOrder = $this->deliveredOrder();

        $this->actingAs($this->customer)
            ->postJson('/api/v1/orders/'.$order->id.'/reviews', [
                'order_item_id' => $otherOrder->items()->firstOrFail()->id,
                'rating' => 5,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('order_item_id');
    }

    public function test_approved_reviews_update_the_product_and_store_ratings(): void
    {
        Setting::put('reviews.require_moderation', false);
        $order = $this->deliveredOrder();

        $this->actingAs($this->customer)
            ->postJson('/api/v1/orders/'.$order->id.'/reviews', [
                'order_item_id' => $order->items()->firstOrFail()->id,
                'rating' => 5,
                'comment' => 'Great product.',
            ])
            ->assertCreated()
            ->assertJsonPath('data.status', 'approved');

        $product = $this->product->fresh();
        $this->assertSame(1, $product->rating_count);
        $this->assertSame(5.0, (float) $product->rating_avg);

        $store = $this->seller->store->fresh();
        $this->assertSame(1, $store->rating_count);
        $this->assertSame(5.0, (float) $store->rating_avg);
    }

    public function test_rating_must_be_between_one_and_five(): void
    {
        $order = $this->deliveredOrder();

        $this->actingAs($this->customer)
            ->postJson('/api/v1/orders/'.$order->id.'/reviews', [
                'order_item_id' => $order->items()->firstOrFail()->id,
                'rating' => 6,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('rating');
    }
}
