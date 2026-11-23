<?php

namespace Tests\Feature\Database;

use App\Enums\NegotiationStatus;
use App\Enums\OfferStatus;
use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Models\Cart;
use App\Models\CartItem;
use App\Models\Category;
use App\Models\Dispute;
use App\Models\DisputeMessage;
use App\Models\InventoryMovement;
use App\Models\Message;
use App\Models\Negotiation;
use App\Models\NegotiationOffer;
use App\Models\Order;
use App\Models\OrderAddress;
use App\Models\OrderGroup;
use App\Models\OrderItem;
use App\Models\OrderStatusHistory;
use App\Models\Payment;
use App\Models\Product;
use App\Models\ProductImage;
use App\Models\ProductReview;
use App\Models\ProductVariant;
use App\Models\Store;
use App\Models\StoreAddress;
use App\Models\StoreApplication;
use App\Models\User;
use App\Models\UserAddress;
use App\Models\Wishlist;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RelationshipsTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_store_and_application_relationships(): void
    {
        $seller = User::factory()->create();
        $application = StoreApplication::factory()->approved()->for($seller)->create();
        $store = Store::factory()->active()->for($seller, 'owner')->create(['store_application_id' => $application->id]);
        StoreAddress::factory()->for($store)->create();
        StoreAddress::factory()->pickup()->for($store)->create();
        UserAddress::factory()->default()->for($seller)->create();

        $seller->refresh();
        $this->assertTrue($seller->store->is($store));
        $this->assertTrue($store->owner->is($seller));
        $this->assertTrue($store->application->is($application));
        $this->assertTrue($application->store->is($store));
        $this->assertInstanceOf(User::class, $application->reviewer);
        $this->assertCount(2, $store->addresses);
        $this->assertCount(1, $seller->storeApplications);
        $this->assertNotNull($seller->defaultAddress);
    }

    public function test_catalog_relationships(): void
    {
        $parent = Category::factory()->create();
        $child = Category::factory()->create(['parent_id' => $parent->id]);
        $product = Product::factory()->published()->create(['category_id' => $child->id]);
        ProductImage::factory()->for($product)->count(2)->sequence(['sort_order' => 1], ['sort_order' => 0])->create();
        $variant = ProductVariant::factory()->for($product)->create(['price' => null]);

        $this->assertTrue($child->parent->is($parent));
        $this->assertTrue($parent->children->first()->is($child));
        $this->assertTrue($product->category->is($child));
        $this->assertCount(2, $product->images);
        $this->assertSame(0, $product->primaryImage->sort_order);
        $this->assertTrue($variant->product->is($product));
        $this->assertSame($product->price, $variant->effectivePrice());
        $this->assertCount(1, $product->store->products);
        $this->assertCount(1, $product->store->owner->storeProducts);
    }

    public function test_negotiation_offer_and_message_relationships(): void
    {
        $negotiation = Negotiation::factory()->create();
        $first = NegotiationOffer::factory()->for($negotiation)->status(OfferStatus::Countered)->create();
        $counter = NegotiationOffer::factory()->for($negotiation)->fromSeller()->create(['parent_offer_id' => $first->id]);
        $message = Message::factory()->for($negotiation)->create(['offer_id' => $counter->id]);

        $negotiation->refresh();
        $this->assertTrue($negotiation->customer->is($negotiation->customer));
        $this->assertTrue($negotiation->store->is($negotiation->product->store));
        $this->assertCount(2, $negotiation->offers);
        $this->assertTrue($negotiation->latestOffer->is($counter));
        $this->assertTrue($negotiation->pendingOffer->is($counter));
        $this->assertTrue($counter->parent->is($first));
        $this->assertTrue($first->counters->first()->is($counter));
        $this->assertTrue($counter->sender->is($negotiation->store->owner));
        $this->assertTrue($message->offer->is($counter));
        $this->assertCount(1, $negotiation->messages);

        $this->assertTrue($negotiation->isParticipant($negotiation->customer));
        $this->assertTrue($negotiation->isParticipant($negotiation->store->owner));
        $this->assertFalse($negotiation->isParticipant(User::factory()->create()));
        $this->assertSame(1, Negotiation::forParticipant($negotiation->store->owner)->count());
        $this->assertSame(0, Negotiation::forParticipant(User::factory()->create())->count());
    }

    public function test_order_group_orders_items_payment_and_history(): void
    {
        $group = OrderGroup::factory()->create();
        [$orderA, $orderB] = Order::factory()->count(2)->for($group, 'group')->create();
        $item = OrderItem::factory()->for($orderA)->create();
        OrderItem::factory()->for($orderB)->create();
        OrderAddress::factory()->for($orderA)->create();
        Payment::factory()->for($orderA)->create();
        OrderStatusHistory::factory()->for($orderA)->create();

        $negotiation = Negotiation::factory()->status(NegotiationStatus::ConvertedToOrder)->create([
            'customer_id' => $group->customer_id,
            'converted_order_id' => $orderA->id,
        ]);

        $group->refresh();
        $this->assertCount(2, $group->orders);
        $this->assertCount(2, $group->items);
        $this->assertTrue($orderA->customer->is($group->customer));
        $this->assertTrue($item->order->is($orderA));
        $this->assertNotNull($orderA->address);
        $this->assertSame(PaymentStatus::Unpaid, $orderA->payment->status);
        $this->assertSame(OrderStatus::Pending, $orderA->statusHistory->first()->to_status);
        $this->assertTrue($negotiation->convertedOrder->is($orderA));
        $this->assertCount(2, $group->customer->orders);
    }

    public function test_review_cart_wishlist_inventory_and_dispute_relationships(): void
    {
        $review = ProductReview::factory()->create();
        $this->assertTrue($review->orderItem->review->is($review));
        $this->assertTrue($review->author->is($review->orderItem->order->customer));
        $this->assertCount(1, $review->product->store->reviews);

        $cartItem = CartItem::factory()->create();
        $this->assertTrue($cartItem->cart->items->first()->is($cartItem));
        $this->assertInstanceOf(Cart::class, $cartItem->cart->user->cart);

        $wishlist = Wishlist::factory()->create();
        $product = Product::factory()->published()->create();
        $wishlist->products()->attach($product);
        $this->assertTrue($wishlist->user->wishlist->products->first()->is($product));

        $movement = InventoryMovement::factory()->create();
        $this->assertCount(1, $movement->product->inventoryMovements);

        $dispute = Dispute::factory()->create();
        DisputeMessage::factory()->for($dispute)->create();
        $this->assertCount(1, $dispute->messages);
        $this->assertCount(1, $dispute->order->disputes);
        $this->assertTrue($dispute->opener->is($dispute->order->customer));
    }
}
