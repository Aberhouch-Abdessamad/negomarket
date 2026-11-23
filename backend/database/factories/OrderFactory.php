<?php

namespace Database\Factories;

use App\Enums\OrderStatus;
use App\Models\Order;
use App\Models\OrderGroup;
use App\Models\Store;
use Database\Factories\Concerns\ResolvesModels;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Order>
 */
class OrderFactory extends Factory
{
    use ResolvesModels;

    protected $model = Order::class;

    public function definition(): array
    {
        $subtotal = fake()->randomFloat(2, 100, 3000);

        return [
            'order_group_id' => OrderGroup::factory(),
            'store_id' => Store::factory()->active(),
            'customer_id' => fn (array $attributes) => self::resolve(OrderGroup::class, $attributes['order_group_id'])->customer_id,
            'reference_number' => 'NM-'.now()->format('ymd').'-'.strtoupper(Str::random(8)),
            'subtotal' => $subtotal,
            'shipping_cost' => 0,
            'discount' => 0,
            'total_amount' => $subtotal,
            'status' => OrderStatus::Pending,
        ];
    }

    public function status(OrderStatus $status): static
    {
        return $this->state(['status' => $status]);
    }
}
