<?php

namespace Tests\Feature\Negotiation;

use App\Enums\NegotiationStatus;
use App\Enums\OfferSenderRole;
use App\Enums\OfferStatus;
use App\Events\OfferAccepted;
use App\Events\OfferCreated;
use App\Models\Negotiation;
use App\Models\NegotiationOffer;
use App\Models\Product;
use App\Models\User;
use App\Notifications\NegotiationNotification;
use App\Services\Negotiation\NegotiationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Notification;
use Tests\Concerns\ActsAsSpa;
use Tests\Concerns\BuildsNegotiations;
use Tests\TestCase;

class NegotiationTest extends TestCase
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
        $this->product = $this->negotiableProduct($this->seller);
    }

    private function start(array $overrides = []): Negotiation
    {
        $response = $this->actingAs($this->customer)
            ->postJson('/api/v1/negotiations', $this->offerPayload($this->product, $overrides))
            ->assertCreated();

        return Negotiation::query()->findOrFail($response->json('data.id'));
    }

    public function test_customer_starts_a_negotiation_with_a_structured_first_offer(): void
    {
        Event::fake([OfferCreated::class]);

        $response = $this->actingAs($this->customer)
            ->postJson('/api/v1/negotiations', $this->offerPayload($this->product, ['amount' => 850, 'quantity' => 2]))
            ->assertCreated()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.status', NegotiationStatus::Active->value)
            ->assertJsonPath('data.role', 'customer')
            ->assertJsonPath('data.quantity', 2)
            ->assertJsonPath('data.offers.0.amount', 850)
            ->assertJsonPath('data.offers.0.status', OfferStatus::Pending->value)
            ->assertJsonPath('data.offers.0.sender_role', OfferSenderRole::Customer->value);

        $negotiation = Negotiation::query()->findOrFail($response->json('data.id'));
        $this->assertSame($this->customer->id, $negotiation->customer_id);
        $this->assertSame($this->seller->store->id, $negotiation->store_id);
        $this->assertNotNull($negotiation->expires_at);

        $offer = $negotiation->offers()->firstOrFail();
        $this->assertSame('850.00', $offer->amount);
        $this->assertTrue($offer->expires_at->isFuture());

        // The private minimum price is never serialised.
        $response->assertJsonMissingPath('data.product.minimum_price');
        $this->assertStringNotContainsString('minimum_price', $response->getContent());

        Notification::assertSentTo($this->seller, NegotiationNotification::class);
        Event::assertDispatched(OfferCreated::class);
        $this->assertDatabaseHas('activity_logs', ['action' => 'negotiation.started', 'subject_id' => $negotiation->id]);
    }

    public function test_negotiation_validation_rules(): void
    {
        $this->actingAs($this->customer)
            ->postJson('/api/v1/negotiations', $this->offerPayload($this->product, ['amount' => 1200]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('amount');

        $this->actingAs($this->customer)
            ->postJson('/api/v1/negotiations', $this->offerPayload($this->product, ['quantity' => 11]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('quantity');

        $this->actingAs($this->customer)
            ->postJson('/api/v1/negotiations', $this->offerPayload($this->product, ['amount' => 0]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('amount');

        $nonNegotiable = $this->negotiableProduct($this->seller, ['allow_negotiation' => false, 'minimum_price' => null]);
        $this->actingAs($this->customer)
            ->postJson('/api/v1/negotiations', $this->offerPayload($nonNegotiable))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('product_id');

        $this->actingAs($this->customer)
            ->postJson('/api/v1/negotiations', $this->offerPayload($this->product, ['product_variant_id' => 999999]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('product_variant_id');

        $this->assertDatabaseCount('negotiations', 0);
    }

    public function test_customer_cannot_negotiate_with_their_own_store(): void
    {
        $this->seller->assignRole('customer');

        $this->actingAs($this->seller)
            ->postJson('/api/v1/negotiations', $this->offerPayload($this->product))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('product_id');
    }

    public function test_only_one_active_negotiation_per_customer_and_product(): void
    {
        $this->start();

        $this->actingAs($this->customer)
            ->postJson('/api/v1/negotiations', $this->offerPayload($this->product, ['amount' => 880]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('product_id');

        $this->assertSame(1, Negotiation::query()->count());
    }

    public function test_seller_sees_and_counters_the_offer_with_history_preserved(): void
    {
        $negotiation = $this->start();
        $first = $negotiation->offers()->firstOrFail();

        $response = $this->actingAs($this->seller)
            ->postJson("/api/v1/negotiations/{$negotiation->id}/offers", [
                'amount' => 940,
                'message' => 'Best I can do.',
            ])
            ->assertCreated()
            ->assertJsonPath('data.amount', 940)
            ->assertJsonPath('data.sender_role', OfferSenderRole::Seller->value)
            ->assertJsonPath('data.status', OfferStatus::Pending->value);

        $this->assertSame(OfferStatus::Countered->value, $first->fresh()->status->value);
        $this->assertSame($this->seller->id, $first->fresh()->responded_by);
        $this->assertSame(2, $negotiation->offers()->count());
        $this->assertSame($this->seller->id, $negotiation->offers()->reorder()->latest('id')->first()->sender_id);
        $this->assertNotNull($response->json('data.id'));

        // A customer may counter below the seller's private minimum (the seller decides),
        // but a seller counter below their own minimum or above the listed price is refused.
        $this->actingAs($this->customer)
            ->postJson("/api/v1/negotiations/{$negotiation->id}/offers", ['amount' => 700])
            ->assertCreated();

        $this->actingAs($this->seller)
            ->postJson("/api/v1/negotiations/{$negotiation->id}/offers", ['amount' => 790])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('amount');

        $this->actingAs($this->seller)
            ->postJson("/api/v1/negotiations/{$negotiation->id}/offers", ['amount' => 1001])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('amount');
    }

    public function test_customer_accepts_a_seller_counter_offer(): void
    {
        Event::fake([OfferAccepted::class]);

        $negotiation = $this->start();
        $this->actingAs($this->seller)
            ->postJson("/api/v1/negotiations/{$negotiation->id}/offers", ['amount' => 900])
            ->assertCreated();
        $counter = $negotiation->offers()->where('status', OfferStatus::Pending->value)->firstOrFail();

        $this->actingAs($this->customer)
            ->postJson("/api/v1/negotiations/{$negotiation->id}/offers/{$counter->id}/accept")
            ->assertOk()
            ->assertJsonPath('data.status', NegotiationStatus::Accepted->value)
            ->assertJsonPath('data.accepted_offer.id', $counter->id)
            ->assertJsonPath('data.accepted_offer.amount', 900)
            ->assertJsonPath('data.unread_count', 0);

        $negotiation->refresh();
        $this->assertSame(NegotiationStatus::Accepted, $negotiation->status);
        $this->assertSame($counter->id, $negotiation->accepted_offer_id);
        $this->assertSame(OfferStatus::Accepted, $counter->fresh()->status);
        $this->assertTrue($negotiation->expires_at->isFuture());

        Event::assertDispatched(OfferAccepted::class);

        // An accepted negotiation accepts no further offers.
        $this->actingAs($this->seller)
            ->postJson("/api/v1/negotiations/{$negotiation->id}/offers", ['amount' => 950])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('negotiation');
    }

    public function test_offer_cannot_be_accepted_when_product_is_out_of_stock(): void
    {
        $negotiation = $this->start();
        $offer = $negotiation->offers()->firstOrFail();
        $this->product->forceFill(['stock_quantity' => 0])->save();

        $this->actingAs($this->seller)
            ->postJson("/api/v1/negotiations/{$negotiation->id}/offers/{$offer->id}/accept")
            ->assertUnprocessable()
            ->assertJsonValidationErrors('stock');

        $this->assertSame(NegotiationStatus::Active, $negotiation->fresh()->status);
    }

    public function test_seller_rejects_an_offer_and_the_negotiation_closes(): void
    {
        $negotiation = $this->start();
        $offer = $negotiation->offers()->firstOrFail();

        $this->actingAs($this->seller)
            ->postJson("/api/v1/negotiations/{$negotiation->id}/offers/{$offer->id}/reject")
            ->assertOk()
            ->assertJsonPath('data.status', NegotiationStatus::Rejected->value);

        $negotiation->refresh();
        $this->assertSame(OfferStatus::Rejected, $offer->fresh()->status);
        $this->assertNotNull($negotiation->closed_at);
    }

    public function test_customer_cannot_respond_to_their_own_offer(): void
    {
        $negotiation = $this->start();
        $offer = $negotiation->offers()->firstOrFail();

        $this->actingAs($this->customer)
            ->postJson("/api/v1/negotiations/{$negotiation->id}/offers/{$offer->id}/accept")
            ->assertUnprocessable()
            ->assertJsonValidationErrors('offer');
    }

    public function test_only_the_latest_pending_offer_can_be_answered(): void
    {
        $negotiation = $this->start();
        $first = $negotiation->offers()->firstOrFail();
        $this->actingAs($this->seller)
            ->postJson("/api/v1/negotiations/{$negotiation->id}/offers", ['amount' => 930])
            ->assertCreated();

        $this->actingAs($this->customer)
            ->postJson("/api/v1/negotiations/{$negotiation->id}/offers/{$first->id}/accept")
            ->assertUnprocessable()
            ->assertJsonValidationErrors('offer');
    }

    public function test_an_offer_from_another_negotiation_cannot_be_answered(): void
    {
        $first = $this->start();
        $otherProduct = $this->negotiableProduct($this->seller);
        $second = $this->start(['product_id' => $otherProduct->id]);
        $otherOffer = $second->offers()->firstOrFail();

        $this->actingAs($this->seller)
            ->postJson("/api/v1/negotiations/{$first->id}/offers/{$otherOffer->id}/accept")
            ->assertUnprocessable()
            ->assertJsonValidationErrors('offer');
    }

    public function test_customer_cancels_a_negotiation_and_pending_offers_are_withdrawn(): void
    {
        $negotiation = $this->start();

        $this->actingAs($this->customer)
            ->postJson("/api/v1/negotiations/{$negotiation->id}/cancel", ['reason' => 'Changed my mind'])
            ->assertOk()
            ->assertJsonPath('data.status', NegotiationStatus::Cancelled->value);

        $this->assertSame(OfferStatus::Withdrawn, $negotiation->offers()->firstOrFail()->status);
        $this->assertDatabaseHas('activity_logs', ['action' => 'negotiation.cancelled', 'subject_id' => $negotiation->id]);
    }

    public function test_expired_offers_cannot_be_accepted_and_the_command_closes_them(): void
    {
        $negotiation = $this->start();
        $offer = $negotiation->offers()->firstOrFail();
        $offer->forceFill(['expires_at' => now()->subMinute()])->save();

        $this->actingAs($this->seller)
            ->postJson("/api/v1/negotiations/{$negotiation->id}/offers/{$offer->id}/accept")
            ->assertUnprocessable()
            ->assertJsonValidationErrors('offer');

        $this->artisan('negotiations:expire')->assertSuccessful();

        $negotiation->refresh();
        $this->assertSame(NegotiationStatus::Expired, $negotiation->status);
        $this->assertSame(OfferStatus::Expired, $offer->fresh()->status);
    }

    public function test_accepted_negotiation_expires_when_checkout_window_passes(): void
    {
        $negotiation = $this->start();
        $offer = $negotiation->offers()->firstOrFail();
        $this->actingAs($this->seller)
            ->postJson("/api/v1/negotiations/{$negotiation->id}/offers/{$offer->id}/accept")
            ->assertOk();

        $negotiation->forceFill(['expires_at' => now()->subMinute()])->save();
        $this->artisan('negotiations:expire')->assertSuccessful();

        $this->assertSame(NegotiationStatus::Expired, $negotiation->fresh()->status);
    }

    public function test_participants_list_their_negotiations_and_outsiders_are_blocked(): void
    {
        $negotiation = $this->start();

        $this->actingAs($this->customer)
            ->getJson('/api/v1/negotiations?role=customer')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $negotiation->id)
            ->assertJsonPath('data.0.role', 'customer');

        $this->actingAs($this->seller)
            ->getJson('/api/v1/negotiations?role=seller')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.role', 'seller');

        $outsider = $this->customer();
        $this->actingAs($outsider)
            ->getJson('/api/v1/negotiations')
            ->assertOk()
            ->assertJsonCount(0, 'data');

        $this->actingAs($outsider)
            ->getJson("/api/v1/negotiations/{$negotiation->id}")
            ->assertForbidden();
    }

    public function test_negotiation_list_filters_by_status_and_search(): void
    {
        $negotiation = $this->start();
        $otherProduct = $this->negotiableProduct($this->seller, ['name' => 'Blue Teapot']);
        $this->start(['product_id' => $otherProduct->id]);

        $this->actingAs($this->customer)
            ->getJson('/api/v1/negotiations?status=active')
            ->assertOk()
            ->assertJsonCount(2, 'data');

        $this->actingAs($this->customer)
            ->getJson('/api/v1/negotiations?q='.urlencode($otherProduct->name))
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.product.id', $otherProduct->id);

        $this->actingAs($this->customer)
            ->postJson("/api/v1/negotiations/{$negotiation->id}/cancel")
            ->assertOk();

        $this->actingAs($this->customer)
            ->getJson('/api/v1/negotiations?status=cancelled')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $negotiation->id);
    }

    public function test_only_an_accepted_negotiation_can_be_converted_to_an_order(): void
    {
        $negotiation = $this->start();

        $this->expectException(\Illuminate\Validation\ValidationException::class);

        app(NegotiationService::class)->convertToOrder($negotiation, new \App\Models\Order);
    }

    public function test_seller_cannot_open_a_negotiation_without_the_customer_permission(): void
    {
        $seller = User::factory()->create();
        $seller->assignRole('seller');
        \App\Models\Store::factory()->active()->for($seller, 'owner')->create();
        $product = $this->negotiableProduct($seller->fresh());

        $this->actingAs($seller->fresh())
            ->postJson('/api/v1/negotiations', $this->offerPayload($product))
            ->assertForbidden();
    }
}
