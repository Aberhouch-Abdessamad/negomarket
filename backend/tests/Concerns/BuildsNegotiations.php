<?php

namespace Tests\Concerns;

use App\Models\Category;
use App\Models\Product;
use App\Models\Store;
use App\Models\User;

/** Shared fixtures for negotiation, cart, checkout and order tests. */
trait BuildsNegotiations
{
    protected function sellerWithStore(string $state = 'active'): User
    {
        $seller = $this->customer();
        $seller->assignRole('seller');
        Store::factory()->{$state}()->for($seller, 'owner')->create();

        return $seller->fresh();
    }

    /**
     * A published, negotiable product owned by the given seller.
     *
     * @param  array<string, mixed>  $attributes
     */
    protected function negotiableProduct(User $seller, array $attributes = []): Product
    {
        $store = $seller->store;

        return Product::factory()
            ->published()
            ->for($store)
            ->for(Category::factory())
            ->create(array_merge([
                'price' => 1000,
                'minimum_price' => 800,
                'allow_negotiation' => true,
                'stock_quantity' => 10,
            ], $attributes));
    }

    /** @param array<string, mixed> $overrides */
    protected function offerPayload(Product $product, array $overrides = []): array
    {
        return array_merge([
            'product_id' => $product->id,
            'quantity' => 1,
            'amount' => 900,
            'message' => 'Would you accept this price?',
        ], $overrides);
    }
}
