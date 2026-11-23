<?php

namespace Tests\Feature\Negotiation;

use App\Enums\NegotiationStatus;
use App\Enums\OfferStatus;
use App\Events\MessageSent;
use App\Models\Message;
use App\Models\Negotiation;
use App\Models\Product;
use App\Models\User;
use App\Notifications\NegotiationNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Tests\Concerns\ActsAsSpa;
use Tests\Concerns\BuildsNegotiations;
use Tests\TestCase;

class NegotiationChatTest extends TestCase
{
    use ActsAsSpa, BuildsNegotiations, RefreshDatabase;

    private User $seller;

    private User $customer;

    private Product $product;

    private Negotiation $negotiation;

    protected function setUp(): void
    {
        parent::setUp();
        Notification::fake();
        $this->seller = $this->sellerWithStore();
        $this->customer = $this->customer();
        $this->product = $this->negotiableProduct($this->seller);

        $response = $this->actingAs($this->customer)
            ->postJson('/api/v1/negotiations', $this->offerPayload($this->product))
            ->assertCreated();

        $this->negotiation = Negotiation::query()->findOrFail($response->json('data.id'));
    }

    public function test_participants_exchange_messages_with_idempotent_client_ids(): void
    {
        Event::fake([MessageSent::class]);
        $uuid = (string) Str::uuid();

        $this->actingAs($this->customer)
            ->postJson("/api/v1/negotiations/{$this->negotiation->id}/messages", [
                'message' => 'Hello, is this still available?',
                'client_message_id' => $uuid,
            ])
            ->assertCreated()
            ->assertJsonPath('data.body', 'Hello, is this still available?')
            ->assertJsonPath('data.client_message_id', $uuid);

        // A reconnect/retry with the same client UUID must not duplicate the row.
        $this->actingAs($this->customer)
            ->postJson("/api/v1/negotiations/{$this->negotiation->id}/messages", [
                'message' => 'Hello, is this still available?',
                'client_message_id' => $uuid,
            ])
            ->assertCreated();

        $this->assertSame(1, Message::query()->where('client_message_id', $uuid)->count());
        Notification::assertSentTo($this->seller, NegotiationNotification::class);
        Event::assertDispatched(MessageSent::class);
    }

    public function test_messages_are_validated_and_outsiders_cannot_read_or_write(): void
    {
        $this->actingAs($this->customer)
            ->postJson("/api/v1/negotiations/{$this->negotiation->id}/messages", ['message' => 'Hi'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('client_message_id');

        $outsider = $this->customer();
        $this->actingAs($outsider)
            ->getJson("/api/v1/negotiations/{$this->negotiation->id}/messages")
            ->assertForbidden();

        $this->actingAs($outsider)
            ->postJson("/api/v1/negotiations/{$this->negotiation->id}/messages", [
                'message' => 'Hi',
                'client_message_id' => (string) Str::uuid(),
            ])
            ->assertForbidden();
    }

    public function test_reading_a_conversation_marks_incoming_messages_and_resets_the_badge(): void
    {
        $this->actingAs($this->seller)
            ->postJson("/api/v1/negotiations/{$this->negotiation->id}/messages", [
                'message' => 'Yes, it is available.',
                'client_message_id' => (string) Str::uuid(),
            ])
            ->assertCreated();

        $this->actingAs($this->customer)
            ->getJson('/api/v1/negotiations/unread-count')
            ->assertOk()
            ->assertJsonPath('data.unread_count', 1);

        $messages = $this->actingAs($this->customer)
            ->getJson("/api/v1/negotiations/{$this->negotiation->id}/messages")
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.1.body', 'Yes, it is available.');

        $this->assertNotNull(Message::query()->where('sender_id', $this->seller->id)->firstOrFail()->read_at);
        $this->assertNotNull($messages->json('data.1.read_at'));

        $this->actingAs($this->customer)
            ->getJson('/api/v1/negotiations/unread-count')
            ->assertOk()
            ->assertJsonPath('data.unread_count', 0);

        // The sender's own message is not counted as unread for the sender.
        $this->actingAs($this->seller)
            ->getJson('/api/v1/negotiations/unread-count')
            ->assertOk()
            ->assertJsonPath('data.unread_count', 1);
    }

    public function test_closed_negotiations_do_not_accept_new_messages(): void
    {
        $this->actingAs($this->customer)
            ->postJson("/api/v1/negotiations/{$this->negotiation->id}/cancel")
            ->assertOk();

        $this->actingAs($this->customer)
            ->postJson("/api/v1/negotiations/{$this->negotiation->id}/messages", [
                'message' => 'One more thing…',
                'client_message_id' => (string) Str::uuid(),
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('message');
    }

    public function test_message_history_is_paginated_and_ordered_oldest_to_newest(): void
    {
        foreach (range(1, 5) as $i) {
            $this->actingAs($this->customer)
                ->postJson("/api/v1/negotiations/{$this->negotiation->id}/messages", [
                    'message' => "Message {$i}",
                    'client_message_id' => (string) Str::uuid(),
                ])
                ->assertCreated();
        }

        $this->actingAs($this->seller)
            ->getJson("/api/v1/negotiations/{$this->negotiation->id}/messages?per_page=2")
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.body', 'Message 4')
            ->assertJsonPath('data.1.body', 'Message 5');

        $oldest = Message::query()->orderBy('id')->firstOrFail();
        $this->actingAs($this->seller)
            ->getJson("/api/v1/negotiations/{$this->negotiation->id}/messages?before_id={$oldest->id}")
            ->assertOk()
            ->assertJsonCount(0, 'data');
    }

    public function test_offer_message_and_offer_status_are_visible_in_the_thread(): void
    {
        $this->actingAs($this->seller)
            ->postJson("/api/v1/negotiations/{$this->negotiation->id}/offers", [
                'amount' => 920,
                'message' => 'I can do 920.',
            ])
            ->assertCreated();

        $thread = $this->actingAs($this->customer)
            ->getJson("/api/v1/negotiations/{$this->negotiation->id}")
            ->assertOk()
            ->assertJsonPath('data.status', NegotiationStatus::Active->value)
            ->assertJsonPath('data.offers.0.status', OfferStatus::Countered->value)
            ->assertJsonPath('data.offers.1.status', OfferStatus::Pending->value)
            ->assertJsonPath('data.offers.1.message', 'I can do 920.');

        $this->assertCount(2, $thread->json('data.offers'));
        $this->assertDatabaseHas('messages', [
            'negotiation_id' => $this->negotiation->id,
            'sender_id' => $this->seller->id,
            'message' => 'I can do 920.',
            'message_type' => 'offer',
        ]);
    }
}
