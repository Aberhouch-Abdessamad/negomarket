<?php

namespace Tests\Feature\Order;

use App\Enums\OrderStatus;
use App\Models\Dispute;
use App\Models\Product;
use App\Models\User;
use App\Notifications\Order\DisputeNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\Concerns\ActsAsSpa;
use Tests\Concerns\BuildsNegotiations;
use Tests\Concerns\BuildsOrders;
use Tests\TestCase;

class DisputeTest extends TestCase
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

    private function deliveredOrder(?User $customer = null): \App\Models\Order
    {
        return $this->makeOrder(
            $customer ?? $this->customer,
            $this->seller->store,
            $this->product,
            OrderStatus::Delivered,
        );
    }

    private function openDispute(\App\Models\Order $order): \App\Models\Dispute
    {
        $this->actingAs($this->customer)
            ->postJson('/api/v1/orders/'.$order->id.'/disputes', [
                'reason' => 'item_damaged',
                'description' => 'The box arrived crushed and the product is broken.',
            ])
            ->assertCreated();

        return Dispute::query()->latest('id')->firstOrFail();
    }

    public function test_customer_opens_a_dispute_and_the_store_owner_is_notified(): void
    {
        $order = $this->deliveredOrder();

        $this->actingAs($this->customer)
            ->postJson('/api/v1/orders/'.$order->id.'/disputes', [
                'reason' => 'item_damaged',
                'description' => 'The box arrived crushed and the product is broken.',
            ])
            ->assertCreated()
            ->assertJsonPath('data.status', 'open')
            ->assertJsonPath('data.reason', 'item_damaged')
            ->assertJsonPath('data.order_id', $order->id)
            ->assertJsonPath('data.opened_by.id', $this->customer->id)
            ->assertJsonCount(1, 'data.messages')
            ->assertJsonPath('data.messages.0.message', 'The box arrived crushed and the product is broken.');

        Notification::assertSentTo($this->seller, DisputeNotification::class);
    }

    public function test_only_one_active_dispute_is_allowed_per_order(): void
    {
        $order = $this->deliveredOrder();
        $this->openDispute($order);

        $this->actingAs($this->customer)
            ->postJson('/api/v1/orders/'.$order->id.'/disputes', [
                'reason' => 'other',
                'description' => 'A second complaint about the same order.',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('order');

        $this->assertDatabaseCount('disputes', 1);
    }

    public function test_a_dispute_cannot_be_opened_before_the_order_is_shipped(): void
    {
        $order = $this->makeOrder($this->customer, $this->seller->store, $this->product, OrderStatus::Processing);

        $this->actingAs($this->customer)
            ->postJson('/api/v1/orders/'.$order->id.'/disputes', [
                'reason' => 'other',
                'description' => 'Too early to complain about delivery.',
            ])
            ->assertForbidden();

        $this->assertDatabaseCount('disputes', 0);
    }

    public function test_disputes_are_visible_only_to_participants_and_admins(): void
    {
        $d = $this->openDispute($this->deliveredOrder());
        $stranger = $this->customer();

        $this->actingAs($stranger)->getJson('/api/v1/disputes/'.$d->id)->assertForbidden();
        $this->actingAs($stranger)->getJson('/api/v1/disputes')->assertOk()->assertJsonCount(0, 'data');

        $this->actingAs($this->customer)->getJson('/api/v1/disputes')->assertOk()->assertJsonCount(1, 'data');
        $this->actingAs($this->seller)->getJson('/api/v1/disputes')->assertOk()->assertJsonCount(1, 'data');
        $this->actingAs($this->seller)->getJson('/api/v1/disputes/'.$d->id)->assertOk();
    }

    public function test_participants_exchange_messages_and_closed_disputes_stop_accepting_them(): void
    {
        $dispute = $this->openDispute($this->deliveredOrder());

        $this->actingAs($this->seller)
            ->postJson('/api/v1/disputes/'.$dispute->id.'/messages', ['message' => 'We are sorry. A replacement is on the way.'])
            ->assertCreated()
            ->assertJsonCount(2, 'data.messages');

        Notification::assertSentTo($this->customer, DisputeNotification::class);

        $admin = User::factory()->create();
        $admin->assignRole('admin');
        $this->actingAs($admin)
            ->patchJson('/api/v1/admin/disputes/'.$dispute->id, [
                'status' => 'resolved',
                'resolution' => 'Replacement delivered to the customer.',
            ])
            ->assertOk();

        $this->actingAs($this->customer)
            ->postJson('/api/v1/disputes/'.$dispute->id.'/messages', ['message' => 'Thanks.'])
            ->assertForbidden();
    }

    public function test_admin_resolution_requires_a_resolution_text_and_is_audited(): void
    {
        $dispute = $this->openDispute($this->deliveredOrder());
        $admin = User::factory()->create();
        $admin->assignRole('admin');

        $this->actingAs($admin)
            ->patchJson('/api/v1/admin/disputes/'.$dispute->id, ['status' => 'resolved'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('resolution');

        $this->actingAs($admin)
            ->patchJson('/api/v1/admin/disputes/'.$dispute->id, [
                'status' => 'resolved',
                'resolution' => 'Refund approved.',
            ])
            ->assertOk()
            ->assertJsonPath('data.status', 'resolved')
            ->assertJsonPath('data.resolution', 'Refund approved.')
            ->assertJsonPath('data.resolved_by.id', $admin->id);

        $dispute->refresh();
        $this->assertNotNull($dispute->resolved_at);
        $this->assertSame($admin->id, $dispute->resolved_by);

        $this->assertDatabaseHas('activity_logs', [
            'action' => 'dispute.resolved',
            'subject_id' => $dispute->id,
        ]);

        $this->actingAs($admin)
            ->patchJson('/api/v1/admin/disputes/'.$dispute->id, ['status' => 'closed'])
            ->assertUnprocessable();
    }

    public function test_a_seller_cannot_use_the_admin_moderation_route(): void
    {
        $dispute = $this->openDispute($this->deliveredOrder());

        $this->actingAs($this->seller)
            ->patchJson('/api/v1/admin/disputes/'.$dispute->id, ['status' => 'resolved', 'resolution' => 'Done'])
            ->assertForbidden();
    }
}
