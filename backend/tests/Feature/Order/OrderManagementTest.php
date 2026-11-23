<?php

namespace Tests\Feature\Order;

use App\Enums\OrderGroupStatus;
use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Models\Order;
use App\Models\OrderGroup;
use App\Models\Product;
use App\Models\User;
use App\Notifications\Order\OrderStatusChangedNotification;
use App\Notifications\Order\PaymentCollectedNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\Concerns\ActsAsSpa;
use Tests\Concerns\BuildsNegotiations;
use Tests\Concerns\BuildsOrders;
use Tests\TestCase;

class OrderManagementTest extends TestCase
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
        $this->product = $this->negotiableProduct($this->seller, ['price' => 1000, 'stock_quantity' => 8]);
    }

    private function order(OrderStatus $status = OrderStatus::Pending, ?User $customer = null): Order
    {
        return $this->makeOrder($customer ?? $this->customer, $this->seller->store, $this->product, $status);
    }

    public function test_customers_only_see_their_own_orders(): void
    {
        $mine = $this->order();
        $otherCustomer = $this->customer();
        $this->order(OrderStatus::Pending, $otherCustomer);

        $this->actingAs($this->customer)
            ->getJson('/api/v1/orders')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $mine->id)
            ->assertJsonPath('data.0.reference_number', $mine->reference_number);
    }

    public function test_a_customer_cannot_view_someone_elses_order(): void
    {
        $otherCustomer = $this->customer();
        $order = $this->order(OrderStatus::Pending, $otherCustomer);

        $this->actingAs($this->customer)
            ->getJson('/api/v1/orders/'.$order->id)
            ->assertForbidden();
    }

    public function test_a_customer_can_cancel_a_pending_order_and_stock_is_restored_once(): void
    {
        $order = $this->order();

        $this->actingAs($this->customer)
            ->postJson('/api/v1/orders/'.$order->id.'/cancel', ['reason' => 'Changed my mind'])
            ->assertOk()
            ->assertJsonPath('data.status', 'cancelled')
            ->assertJsonPath('data.cancellation_reason', 'Changed my mind');

        $order->refresh();
        $this->assertSame(OrderStatus::Cancelled, $order->status);
        $this->assertNotNull($order->cancelled_at);
        $this->assertSame($this->customer->id, $order->cancelled_by);
        $this->assertSame(10, $this->product->fresh()->stock_quantity);

        $this->assertDatabaseHas('inventory_movements', [
            'reference_type' => $order->items()->first()->getMorphClass(),
            'reference_id' => $order->items()->first()->id,
            'type' => 'cancellation_restore',
            'quantity_change' => 2,
        ]);
        $this->assertDatabaseHas('order_status_histories', [
            'order_id' => $order->id,
            'from_status' => 'pending',
            'to_status' => 'cancelled',
        ]);
        $this->assertSame(OrderGroupStatus::Cancelled, OrderGroup::query()->findOrFail($order->order_group_id)->status);

        Notification::assertSentTo($this->seller, OrderStatusChangedNotification::class);
    }

    public function test_a_customer_cannot_cancel_after_shipping(): void
    {
        $order = $this->order(OrderStatus::Shipped);

        $this->actingAs($this->customer)
            ->postJson('/api/v1/orders/'.$order->id.'/cancel', ['reason' => 'Too late'])
            ->assertForbidden();

        $this->assertSame(OrderStatus::Shipped, $order->fresh()->status);
        $this->assertDatabaseCount('inventory_movements', 0);
    }

    public function test_only_one_store_order_in_a_group_cancelled_marks_the_group_partially_cancelled(): void
    {
        $secondSeller = $this->sellerWithStore();
        $secondProduct = $this->negotiableProduct($secondSeller, ['stock_quantity' => 8]);

        $first = $this->order();
        $second = $this->makeOrder(
            $this->customer,
            $secondSeller->store,
            $secondProduct,
            OrderStatus::Pending,
            2,
            1000,
            OrderGroup::query()->findOrFail($first->order_group_id),
        );
        $this->assertSame($first->order_group_id, $second->order_group_id);

        $this->actingAs($this->customer)
            ->postJson('/api/v1/orders/'.$first->id.'/cancel')
            ->assertOk();

        $this->assertSame(
            OrderGroupStatus::PartiallyCancelled,
            OrderGroup::query()->findOrFail($first->order_group_id)->status,
        );
    }

    public function test_seller_moves_an_order_forward_and_records_timestamps_and_history(): void
    {
        $order = $this->order();

        $this->actingAs($this->seller)
            ->patchJson('/api/v1/seller/orders/'.$order->id.'/status', ['status' => 'confirmed', 'note' => 'Payment expected on delivery'])
            ->assertOk()
            ->assertJsonPath('data.status', 'confirmed');

        $this->assertNotNull($order->fresh()->confirmed_at);

        $this->actingAs($this->seller)
            ->patchJson('/api/v1/seller/orders/'.$order->id.'/status', ['status' => 'processing'])
            ->assertOk();
        $this->actingAs($this->seller)
            ->patchJson('/api/v1/seller/orders/'.$order->id.'/status', ['status' => 'shipped'])
            ->assertOk();

        $this->assertNotNull($order->fresh()->shipped_at);
        $this->assertDatabaseCount('order_status_histories', 3);
        $this->assertDatabaseHas('order_status_histories', [
            'order_id' => $order->id,
            'from_status' => 'processing',
            'to_status' => 'shipped',
        ]);
        Notification::assertSentTo($this->customer, OrderStatusChangedNotification::class);
    }

    public function test_illegal_status_transitions_are_rejected(): void
    {
        $order = $this->order(OrderStatus::Pending);

        $this->actingAs($this->seller)
            ->patchJson('/api/v1/seller/orders/'.$order->id.'/status', ['status' => 'shipped'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('status');

        $this->assertSame(OrderStatus::Pending, $order->fresh()->status);
    }

    public function test_a_seller_cannot_change_another_stores_order(): void
    {
        $otherSeller = $this->sellerWithStore();
        $otherProduct = $this->negotiableProduct($otherSeller);
        $order = $this->makeOrder($this->customer, $otherSeller->store, $otherProduct);

        $this->actingAs($this->seller)
            ->patchJson('/api/v1/seller/orders/'.$order->id.'/status', ['status' => 'confirmed'])
            ->assertForbidden();

        $this->actingAs($this->seller)
            ->getJson('/api/v1/seller/orders/'.$order->id)
            ->assertForbidden();
    }

    public function test_a_seller_can_cancel_and_restore_stock_until_processing(): void
    {
        $order = $this->order(OrderStatus::Processing);

        $this->actingAs($this->seller)
            ->postJson('/api/v1/seller/orders/'.$order->id.'/cancel', ['reason' => 'Out of stock'])
            ->assertOk()
            ->assertJsonPath('data.cancellation_reason', 'Out of stock');

        $this->assertSame(10, $this->product->fresh()->stock_quantity);
        $this->assertSame(OrderStatus::Cancelled, $order->fresh()->status);
        Notification::assertSentTo($this->customer, OrderStatusChangedNotification::class);
    }

    public function test_customer_receipt_moves_a_shipped_order_to_delivered(): void
    {
        $order = $this->order(OrderStatus::Shipped);

        $this->actingAs($this->customer)
            ->postJson('/api/v1/orders/'.$order->id.'/receipt')
            ->assertOk()
            ->assertJsonPath('data.status', 'delivered');

        $order->refresh();
        $this->assertNotNull($order->delivered_at);
        $this->assertNotNull($order->received_at);
        $this->assertDatabaseHas('order_status_histories', [
            'order_id' => $order->id,
            'from_status' => 'shipped',
            'to_status' => 'delivered',
        ]);
    }

    public function test_receipt_cannot_be_confirmed_before_shipping_or_twice(): void
    {
        $order = $this->order(OrderStatus::Processing);

        $this->actingAs($this->customer)
            ->postJson('/api/v1/orders/'.$order->id.'/receipt')
            ->assertForbidden();

        $delivered = $this->order(OrderStatus::Delivered);
        $this->actingAs($this->customer)->postJson('/api/v1/orders/'.$delivered->id.'/receipt')->assertOk();
        $this->actingAs($this->customer)->postJson('/api/v1/orders/'.$delivered->id.'/receipt')->assertForbidden();
    }

    public function test_cod_collection_is_recorded_separately_from_the_order_status(): void
    {
        $order = $this->order(OrderStatus::Delivered);

        $this->actingAs($this->seller)
            ->postJson('/api/v1/seller/orders/'.$order->id.'/payment/collect', ['notes' => 'Handed to courier'])
            ->assertOk()
            ->assertJsonPath('data.payment.status', 'collected')
            ->assertJsonPath('data.status', 'delivered');

        $payment = $order->payment()->firstOrFail();
        $this->assertSame(PaymentStatus::Collected, $payment->status);
        $this->assertNotNull($payment->collected_at);
        $this->assertSame($this->seller->id, $payment->collected_by);

        Notification::assertSentTo($this->customer, PaymentCollectedNotification::class);
    }

    public function test_payment_cannot_be_collected_before_delivery_or_twice(): void
    {
        $processing = $this->order(OrderStatus::Processing);
        $this->actingAs($this->seller)
            ->postJson('/api/v1/seller/orders/'.$processing->id.'/payment/collect')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('status');

        $delivered = $this->order(OrderStatus::Delivered);
        $this->actingAs($this->seller)
            ->postJson('/api/v1/seller/orders/'.$delivered->id.'/payment/collect')
            ->assertOk();
        $this->actingAs($this->seller)
            ->postJson('/api/v1/seller/orders/'.$delivered->id.'/payment/collect')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('payment');
    }

    public function test_returning_an_order_restores_stock_with_the_return_movement(): void
    {
        $order = $this->order(OrderStatus::Delivered);

        $this->actingAs($this->seller)
            ->patchJson('/api/v1/seller/orders/'.$order->id.'/status', ['status' => 'returned', 'note' => 'Customer returned the parcel'])
            ->assertOk()
            ->assertJsonPath('data.status', 'returned');

        $this->assertSame(10, $this->product->fresh()->stock_quantity);
        $this->assertDatabaseHas('inventory_movements', [
            'type' => 'return_restore',
            'quantity_change' => 2,
        ]);

        $this->actingAs($this->seller)
            ->patchJson('/api/v1/seller/orders/'.$order->id.'/status', ['status' => 'delivered'])
            ->assertUnprocessable();
    }

    public function test_customer_can_view_the_checkout_group(): void
    {
        $order = $this->order();
        $this->order(OrderStatus::Pending, $this->customer());

        $this->actingAs($this->customer)
            ->getJson('/api/v1/order-groups/'.$order->order_group_id)
            ->assertOk()
            ->assertJsonPath('data.id', $order->order_group_id)
            ->assertJsonCount(1, 'data.orders');

        $stranger = $this->customer();
        $this->actingAs($stranger)
            ->getJson('/api/v1/order-groups/'.$order->order_group_id)
            ->assertForbidden();
    }
}
