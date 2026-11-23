<?php

namespace Database\Factories;

use App\Enums\ReviewStatus;
use App\Models\OrderItem;
use App\Models\ProductReview;
use Database\Factories\Concerns\ResolvesModels;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ProductReview>
 */
class ProductReviewFactory extends Factory
{
    use ResolvesModels;

    protected $model = ProductReview::class;

    public function definition(): array
    {
        return [
            'order_item_id' => OrderItem::factory(),
            'product_id' => fn (array $attributes) => self::resolve(OrderItem::class, $attributes['order_item_id'])->product_id,
            'user_id' => fn (array $attributes) => self::resolve(OrderItem::class, $attributes['order_item_id'], ['order'])->order->customer_id,
            'rating' => fake()->numberBetween(3, 5),
            'comment' => fake()->sentence(),
            'status' => ReviewStatus::Approved,
        ];
    }
}
