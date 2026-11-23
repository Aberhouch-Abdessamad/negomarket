<?php

namespace Tests\Feature\Admin;

use App\Enums\OrderStatus;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\Concerns\ActsAsSpa;
use Tests\Concerns\BuildsNegotiations;
use Tests\Concerns\BuildsOrders;
use Tests\TestCase;

class AdminOrdersTest extends TestCase
{
    use ActsAsSpa, BuildsNegotiations, BuildsOrders, RefreshDatabase;

    private User $admin;

    private User $seller;

    private User $customer;

    private Product $product;

    protected function setUp(): void
    {
        parent::setUp();
        Notification::fake();

        $this->admin = User::factory()->create();
        $this->admin->syncRoles('admin');
        $this->seller = $this->sellerWithStore();
        $this->customer = $this->customer();
        $this->product = $this->negotiableProduct($this->seller, ['stock_quantity' => 8]);
    }

    private function order(OrderStatus $status = OrderStatus::Pending): Order
    {
        return $this->makeOrder($this->customer, $this->seller->store, $this->product, $status);
    }

    public function test_admins_see_orders_from_every_store(): void
    {
        $first = $this->order();
        $secondSeller = $this->sellerWithStore();
        $secondProduct = $this->negotiableProduct($secondSeller);
        $second = $this->makeOrder($this->customer, $secondSeller->store, $secondProduct);

        $this->actingAs($this->admin)
            ->getJson('/api/v1/admin/orders')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonFragment(['id' => $first->id, 'reference_number' => $first->reference_number])
            ->assertJsonFragment(['id' => $second->id, 'reference_number' => $second->reference_number]);

        $this->actingAs($this->admin)
            ->getJson('/api/v1/admin/orders?store_id='.$secondSeller->store->id)
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $second->id);
    }

    public function test_admins_can_open_any_order_with_its_full_detail(): void
    {
        $order = $this->order();

        $this->actingAs($this->admin)
            ->getJson('/api/v1/admin/orders/'.$order->id)
            ->assertOk()
            ->assertJsonPath('data.id', $order->id)
            ->assertJsonPath('data.store.id', $this->seller->store->id)
            ->assertJsonPath('data.customer.id', $this->customer->id)
            ->assertJsonPath('data.items.0.product_id', $this->product->id)
            ->assertJsonPath('data.payment.method', 'cod');
    }

    public function test_admins_can_drive_the_order_state_machine_without_breaking_it(): void
    {
        $order = $this->order();

        $this->actingAs($this->admin)
            ->patchJson('/api/v1/admin/orders/'.$order->id.'/status', [
                'status' => 'confirmed',
                'note' => 'Verified by support.',
            ])
            ->assertOk()
            ->assertJsonPath('data.status', 'confirmed');

        $this->assertNotNull($order->fresh()->confirmed_at);
        $this->assertDatabaseHas('order_status_histories', [
            'order_id' => $order->id,
            'from_status' => 'pending',
            'to_status' => 'confirmed',
            'changed_by' => $this->admin->id,
        ]);

        $this->actingAs($this->admin)
            ->patchJson('/api/v1/admin/orders/'.$order->id.'/status', ['status' => 'shipped'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('status');

        $this->assertSame(OrderStatus::Confirmed, $order->fresh()->status);
    }

    public function test_admins_can_cancel_and_stock_is_restored_once(): void
    {
        $order = $this->order(OrderStatus::Processing);

        $this->actingAs($this->admin)
            ->postJson('/api/v1/admin/orders/'.$order->id.'/cancel', ['reason' => 'Fraud suspicion'])
            ->assertOk()
            ->assertJsonPath('data.status', 'cancelled')
            ->assertJsonPath('data.cancellation_reason', 'Fraud suspicion');

        $order->refresh();
        $this->assertSame(OrderStatus::Cancelled, $order->status);
        $this->assertSame($this->admin->id, $order->cancelled_by);
        $this->assertSame(10, $this->product->fresh()->stock_quantity);

        $this->assertDatabaseHas('inventory_movements', [
            'reference_id' => $order->items()->firstOrFail()->id,
            'type' => 'cancellation_restore',
            'quantity_change' => 2,
        ]);
    }

    public function test_a_cancelled_order_cannot_be_cancelled_again(): void
    {
        $order = $this->order(OrderStatus::Cancelled);

        $this->actingAs($this->admin)
            ->postJson('/api/v1/admin/orders/'.$order->id.'/cancel')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('status');
    }

    public function test_non_admins_cannot_use_the_admin_order_api(): void
    {
        $order = $this->order();

        $this->actingAs($this->seller)
            ->getJson('/api/v1/admin/orders')
            ->assertForbidden();

        $this->actingAs($this->seller)
            ->patchJson('/api/v1/admin/orders/'.$order->id.'/status', ['status' => 'confirmed'])
            ->assertForbidden();
    }

    public function test_dashboard_and_sales_report_expose_platform_metrics(): void
    {
        $this->order(OrderStatus::Delivered);
        $this->order(OrderStatus::Pending);

        $this->actingAs($this->admin)
            ->getJson('/api/v1/admin/dashboard')
            ->assertOk()
            ->assertJsonPath('data.orders.total', 2)
            ->assertJsonPath('data.orders.revenue_total', 4000)
            ->assertJsonCount(2, 'data.recent_orders')
            ->assertJsonCount(14, 'data.sales_series');

        $this->actingAs($this->admin)
            ->getJson('/api/v1/admin/reports/sales?days=7')
            ->assertOk()
            ->assertJsonPath('data.totals.orders', 2)
            ->assertJsonPath('data.totals.revenue', 4000)
            ->assertJsonCount(7, 'data.sales_series')
            ->assertJsonPath('data.top_stores.0.id', $this->seller->store->id);
    }

    public function test_sales_report_validates_its_range(): void
    {
        $this->actingAs($this->admin)
            ->getJson('/api/v1/admin/reports/sales?days=0')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('days');
    }
}
