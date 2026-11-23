<?php

namespace Tests\Feature\Database;

use App\Enums\InventoryMovementType;
use App\Enums\NegotiationStatus;
use App\Enums\OfferStatus;
use App\Enums\StoreApplicationStatus;
use App\Models\CartItem;
use App\Models\InventoryMovement;
use App\Models\Message;
use App\Models\Negotiation;
use App\Models\NegotiationOffer;
use App\Models\OrderGroup;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\ProductReview;
use App\Models\Store;
use App\Models\StoreApplication;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * These invariants are enforced by MySQL itself, so they hold even if a
 * service has a bug or two requests race each other.
 */
class ConstraintsTest extends TestCase
{
    use RefreshDatabase;

    private function assertViolates(callable $callback, string $message = ''): void
    {
        try {
            $callback();
        } catch (QueryException $e) {
            $this->assertMatchesRegularExpression('/(23000|22003|HY000|3819)/', (string) $e->getCode().$e->getMessage(), $message);

            return;
        }
        $this->fail('Expected a database constraint violation. '.$message);
    }

    public function test_stock_can_never_be_negative(): void
    {
        $product = Product::factory()->create(['stock_quantity' => 1]);

        $this->assertViolates(fn () => DB::table('products')->where('id', $product->id)->update(['stock_quantity' => DB::raw('stock_quantity - 2')]));
        $this->assertSame(1, $product->fresh()->stock_quantity);
    }

    public function test_minimum_price_cannot_exceed_listed_price(): void
    {
        $this->assertViolates(fn () => Product::factory()->create(['price' => 100, 'minimum_price' => 150]));
        $this->assertViolates(fn () => Product::factory()->create(['price' => 0]));
        $this->assertSame('100.00', Product::factory()->create(['price' => 100, 'minimum_price' => 100])->minimum_price);
    }

    public function test_a_user_has_at_most_one_pending_store_application(): void
    {
        $user = User::factory()->create();
        StoreApplication::factory()->for($user)->rejected()->create();
        StoreApplication::factory()->for($user)->create();

        $this->assertViolates(fn () => StoreApplication::factory()->for($user)->create(['status' => StoreApplicationStatus::Pending]));
    }

    public function test_a_user_owns_at_most_one_store(): void
    {
        $user = User::factory()->create();
        Store::factory()->for($user, 'owner')->create();

        $this->assertViolates(fn () => Store::factory()->for($user, 'owner')->create());
    }

    public function test_only_one_active_negotiation_per_customer_and_product(): void
    {
        $existing = Negotiation::factory()->create();
        $duplicate = fn () => Negotiation::factory()->create([
            'product_id' => $existing->product_id,
            'store_id' => $existing->store_id,
            'customer_id' => $existing->customer_id,
        ]);

        $this->assertViolates($duplicate);

        // Once the first one is closed, a new active negotiation is allowed.
        DB::table('negotiations')->where('id', $existing->id)->update(['status' => NegotiationStatus::Cancelled->value]);
        $this->assertSame(NegotiationStatus::Active, $duplicate()->status);
    }

    public function test_only_one_pending_and_one_accepted_offer_per_negotiation(): void
    {
        $negotiation = Negotiation::factory()->create();
        NegotiationOffer::factory()->for($negotiation)->create();

        $this->assertViolates(fn () => NegotiationOffer::factory()->for($negotiation)->fromSeller()->create(), 'second pending offer');

        NegotiationOffer::factory()->for($negotiation)->status(OfferStatus::Accepted)->create();
        $this->assertViolates(fn () => NegotiationOffer::factory()->for($negotiation)->status(OfferStatus::Accepted)->create(), 'second accepted offer');

        // Any number of historical (rejected/countered/expired) offers is fine.
        NegotiationOffer::factory()->for($negotiation)->status(OfferStatus::Rejected)->count(3)->create();
        $this->assertSame(5, $negotiation->offers()->count());
    }

    public function test_offer_amount_must_be_positive(): void
    {
        $this->assertViolates(fn () => NegotiationOffer::factory()->create(['amount' => 0]));
    }

    public function test_a_negotiation_converts_into_at_most_one_order_item(): void
    {
        $negotiation = Negotiation::factory()->status(NegotiationStatus::Accepted)->create();
        OrderItem::factory()->create(['negotiation_id' => $negotiation->id]);

        $this->assertViolates(fn () => OrderItem::factory()->create(['negotiation_id' => $negotiation->id]));
    }

    public function test_checkout_idempotency_key_is_unique_per_customer(): void
    {
        $group = OrderGroup::factory()->create();

        $this->assertViolates(fn () => OrderGroup::factory()->create([
            'customer_id' => $group->customer_id,
            'idempotency_key' => $group->idempotency_key,
        ]));
        // Another customer may coincidentally use the same key.
        OrderGroup::factory()->create(['idempotency_key' => $group->idempotency_key]);
    }

    public function test_inventory_movements_are_idempotent_per_reference_and_type(): void
    {
        $item = OrderItem::factory()->create();
        $make = fn (InventoryMovementType $type) => InventoryMovement::factory()->create([
            'product_id' => $item->product_id,
            'type' => $type,
            'reference_type' => $item->getMorphClass(),
            'reference_id' => $item->id,
        ]);

        $make(InventoryMovementType::Sale);
        $make(InventoryMovementType::CancellationRestore);

        $this->assertViolates(fn () => $make(InventoryMovementType::Sale), 'stock deducted twice');
        $this->assertViolates(fn () => $make(InventoryMovementType::CancellationRestore), 'stock restored twice');
    }

    public function test_one_review_per_order_item_and_rating_range(): void
    {
        $review = ProductReview::factory()->create();

        $this->assertViolates(fn () => ProductReview::factory()->create(['order_item_id' => $review->order_item_id]));
        $this->assertViolates(fn () => ProductReview::factory()->create(['rating' => 6]));
    }

    public function test_cart_has_one_line_per_product_and_variant(): void
    {
        $line = CartItem::factory()->create();

        $this->assertViolates(fn () => CartItem::factory()->create(['cart_id' => $line->cart_id, 'product_id' => $line->product_id]));
    }

    public function test_chat_message_client_id_is_idempotent_per_sender(): void
    {
        $message = Message::factory()->create();

        $this->assertViolates(fn () => Message::factory()->create([
            'negotiation_id' => $message->negotiation_id,
            'client_message_id' => $message->client_message_id,
        ]));
    }

    public function test_products_with_orders_cannot_be_hard_deleted(): void
    {
        $item = OrderItem::factory()->create();

        $this->assertViolates(fn () => DB::table('products')->where('id', $item->product_id)->delete());
    }
}
