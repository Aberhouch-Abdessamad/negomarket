<?php

namespace Database\Factories;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use Database\Factories\Concerns\ResolvesModels;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<OrderItem>
 */
class OrderItemFactory extends Factory
{
    use ResolvesModels;

    protected $model = OrderItem::class;

    public function definition(): array
    {
        return [
            'order_id' => Order::factory(),
            'product_id' => fn (array $attributes) => Product::factory()->published()->create([
                'store_id' => self::resolve(Order::class, $attributes['order_id'])->store_id,
            ])->id,
            'product_name' => fn (array $attributes) => self::resolve(Product::class, $attributes['product_id'])->name,
            'sku' => fn (array $attributes) => self::resolve(Product::class, $attributes['product_id'])->sku,
            'quantity' => 1,
            'original_price' => fn (array $attributes) => self::resolve(Product::class, $attributes['product_id'])->price,
            'unit_price' => fn (array $attributes) => $attributes['original_price'],
            'total_price' => fn (array $attributes) => round($attributes['unit_price'] * $attributes['quantity'], 2),
        ];
    }
}
