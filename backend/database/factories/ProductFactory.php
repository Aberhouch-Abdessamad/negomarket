<?php

namespace Database\Factories;

use App\Enums\ProductStatus;
use App\Models\Category;
use App\Models\Product;
use App\Models\Store;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Product>
 */
class ProductFactory extends Factory
{
    protected $model = Product::class;

    public function definition(): array
    {
        $name = Str::title(fake()->unique()->words(3, true));

        return [
            'store_id' => Store::factory()->active(),
            'category_id' => Category::factory(),
            'name' => $name,
            'slug' => Str::slug($name).'-'.Str::lower(Str::random(5)),
            'sku' => strtoupper(Str::random(3)).'-'.fake()->unique()->numerify('######'),
            'description' => fake()->paragraphs(2, true),
            'price' => fake()->randomFloat(2, 50, 5000),
            'minimum_price' => null,
            'stock_quantity' => fake()->numberBetween(5, 100),
            'allow_negotiation' => false,
            'status' => ProductStatus::Draft,
            'featured' => false,
        ];
    }

    public function published(): static
    {
        return $this->state(['status' => ProductStatus::Published, 'published_at' => now()]);
    }

    public function pendingReview(): static
    {
        return $this->state(['status' => ProductStatus::PendingReview]);
    }

    /** Enables negotiation with a minimum price at the given ratio of the listed price. */
    public function negotiable(float $minimumRatio = 0.8): static
    {
        return $this->state(fn (array $attributes) => [
            'allow_negotiation' => true,
            'minimum_price' => round((float) $attributes['price'] * $minimumRatio, 2),
        ]);
    }

    public function outOfStock(): static
    {
        return $this->state(['stock_quantity' => 0]);
    }

    public function featured(): static
    {
        return $this->state(['featured' => true]);
    }
}
