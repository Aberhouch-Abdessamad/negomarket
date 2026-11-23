<?php

namespace Tests\Feature\Database;

use App\Models\Product;
use Illuminate\Database\Eloquent\MassAssignmentException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PrivacyTest extends TestCase
{
    use RefreshDatabase;

    public function test_minimum_price_is_never_serialised_by_default(): void
    {
        $product = Product::factory()->published()->negotiable()->create();

        $this->assertArrayNotHasKey('minimum_price', $product->toArray());
        $this->assertStringNotContainsString('minimum_price', $product->toJson());
        $this->assertNotNull($product->minimum_price, 'Still readable server-side for offer validation.');
    }

    public function test_sensitive_fields_are_not_mass_assignable(): void
    {
        // Outside production, Model::shouldBeStrict() turns silently discarded
        // attributes into an exception, so attempts are caught during development.
        $this->expectException(MassAssignmentException::class);

        new Product(['name' => 'X', 'store_id' => 999, 'stock_quantity' => 500, 'status' => 'published', 'featured' => true]);
    }
}
