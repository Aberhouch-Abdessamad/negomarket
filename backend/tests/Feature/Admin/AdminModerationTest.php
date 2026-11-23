<?php

namespace Tests\Feature\Admin;

use App\Enums\NegotiationStatus;
use App\Enums\OfferStatus;
use App\Enums\OrderStatus;
use App\Enums\ReviewStatus;
use App\Models\Negotiation;
use App\Models\NegotiationOffer;
use App\Models\Product;
use App\Models\ProductReview;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\Concerns\ActsAsSpa;
use Tests\Concerns\BuildsNegotiations;
use Tests\Concerns\BuildsOrders;
use Tests\TestCase;

class AdminModerationTest extends TestCase
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
        $this->product = $this->negotiableProduct($this->seller);
    }

    public function test_admins_can_monitor_every_negotiation_with_its_offer_history(): void
    {
        $negotiation = Negotiation::factory()
            ->forProduct($this->product)
            ->create(['customer_id' => $this->customer->id]);
        NegotiationOffer::factory()->for($negotiation)
            ->status(OfferStatus::Countered)
            ->create([
                'sender_id' => $this->customer->id,
                'amount' => 850,
            ]);
        NegotiationOffer::factory()->fromSeller()->for($negotiation)->create([
            'sender_id' => $this->seller->id,
            'amount' => 950,
        ]);

        $this->actingAs($this->admin)
            ->getJson('/api/v1/admin/negotiations')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $negotiation->id)
            ->assertJsonPath('data.0.store.id', $this->seller->store->id)
            ->assertJsonPath('data.0.customer.id', $this->customer->id);

        $this->actingAs($this->admin)
            ->getJson('/api/v1/admin/negotiations/'.$negotiation->id)
            ->assertOk()
            ->assertJsonPath('data.id', $negotiation->id)
            ->assertJsonCount(2, 'data.offers')
            ->assertJsonPath('data.offers.1.amount', 950);
    }

    public function test_negotiation_monitoring_can_be_filtered_by_status(): void
    {
        $active = Negotiation::factory()->forProduct($this->product)->create([
            'customer_id' => $this->customer->id,
        ]);
        Negotiation::factory()->forProduct($this->product)
            ->status(NegotiationStatus::Expired)
            ->create(['customer_id' => $this->customer->id]);

        $this->actingAs($this->admin)
            ->getJson('/api/v1/admin/negotiations?status=active')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $active->id);
    }

    public function test_admins_can_approve_pending_reviews_and_ratings_are_recomputed(): void
    {
        $order = $this->makeOrder(
            $this->customer,
            $this->seller->store,
            $this->product,
            OrderStatus::Delivered,
        );

        $this->actingAs($this->customer)
            ->postJson('/api/v1/orders/'.$order->id.'/reviews', [
                'order_item_id' => $order->items()->firstOrFail()->id,
                'rating' => 5,
                'comment' => 'Excellent packaging.',
            ])
            ->assertCreated()
            ->assertJsonPath('data.status', 'pending');

        $review = ProductReview::query()->latest('id')->firstOrFail();

        $this->actingAs($this->admin)
            ->getJson('/api/v1/admin/reviews?status=pending')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $review->id)
            ->assertJsonPath('data.0.product.store.id', $this->seller->store->id);

        $this->actingAs($this->admin)
            ->patchJson('/api/v1/admin/reviews/'.$review->id, ['status' => 'approved'])
            ->assertOk()
            ->assertJsonPath('data.status', 'approved')
            ->assertJsonPath('data.seller_reply', null);

        $this->assertSame(ReviewStatus::Approved, $review->fresh()->status);
        $this->assertSame(5.0, (float) $this->product->fresh()->rating_avg);
        $this->assertSame(1, (int) $this->product->fresh()->rating_count);
        $this->assertDatabaseHas('activity_logs', [
            'action' => 'review.moderated',
            'subject_id' => $review->id,
        ]);
    }

    public function test_admins_can_reject_a_review_and_it_is_not_counted(): void
    {
        $order = $this->makeOrder(
            $this->customer,
            $this->seller->store,
            $this->product,
            OrderStatus::Delivered,
        );

        $review = ProductReview::factory()->create([
            'order_item_id' => $order->items()->firstOrFail()->id,
            'product_id' => $this->product->id,
            'user_id' => $this->customer->id,
            'status' => ReviewStatus::Pending,
            'rating' => 1,
        ]);

        $this->actingAs($this->admin)
            ->patchJson('/api/v1/admin/reviews/'.$review->id, ['status' => 'rejected'])
            ->assertOk()
            ->assertJsonPath('data.status', 'rejected');

        $this->assertSame(0, (int) $this->product->fresh()->rating_count);
    }

    public function test_review_moderation_requires_a_valid_decision(): void
    {
        $order = $this->makeOrder(
            $this->customer,
            $this->seller->store,
            $this->product,
            OrderStatus::Delivered,
        );
        $review = ProductReview::factory()->create([
            'order_item_id' => $order->items()->firstOrFail()->id,
            'product_id' => $this->product->id,
            'user_id' => $this->customer->id,
            'status' => ReviewStatus::Pending,
        ]);

        $this->actingAs($this->admin)
            ->patchJson('/api/v1/admin/reviews/'.$review->id, ['status' => 'pending'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('status');
    }

    public function test_non_admins_cannot_moderate_or_monitor(): void
    {
        $this->actingAs($this->seller)
            ->getJson('/api/v1/admin/negotiations')
            ->assertForbidden();

        $this->actingAs($this->seller)
            ->getJson('/api/v1/admin/reviews')
            ->assertForbidden();
    }
}
