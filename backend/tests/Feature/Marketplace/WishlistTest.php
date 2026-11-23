<?php

namespace Tests\Feature\Marketplace;

use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\ActsAsSpa;
use Tests\TestCase;

class WishlistTest extends TestCase
{
    use ActsAsSpa, RefreshDatabase;

    public function test_customer_can_add_list_and_remove_wishlist_items_idempotently(): void
    {
        $user = $this->customer();
        $product = Product::factory()->published()->create();
        $this->actingAs($user);

        $this->postJson("/api/v1/wishlist/{$product->id}")->assertOk()->assertJsonPath('data.in_wishlist', true);
        $this->postJson("/api/v1/wishlist/{$product->id}")->assertOk();
        $this->getJson('/api/v1/wishlist/ids')->assertOk()->assertExactJson(['success' => true, 'message' => null, 'data' => [$product->id]]);
        $this->getJson('/api/v1/wishlist')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $product->id);

        $this->deleteJson("/api/v1/wishlist/{$product->id}")->assertOk();
        $this->getJson('/api/v1/wishlist')->assertJsonCount(0, 'data');
    }

    public function test_hidden_products_cannot_be_added_and_guests_are_rejected(): void
    {
        $draft = Product::factory()->create();

        $this->postJson("/api/v1/wishlist/{$draft->id}")->assertUnauthorized();
        $this->actingAs($this->customer())->postJson("/api/v1/wishlist/{$draft->id}")->assertNotFound();
    }
}
