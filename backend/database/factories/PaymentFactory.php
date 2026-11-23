<?php

namespace Database\Factories;

use App\Enums\PaymentStatus;
use App\Models\Order;
use App\Models\Payment;
use Database\Factories\Concerns\ResolvesModels;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Payment>
 */
class PaymentFactory extends Factory
{
    use ResolvesModels;

    protected $model = Payment::class;

    public function definition(): array
    {
        return [
            'order_id' => Order::factory(),
            'payment_method' => 'cod',
            'amount' => fn (array $attributes) => self::resolve(Order::class, $attributes['order_id'])->total_amount,
            'status' => PaymentStatus::Unpaid,
        ];
    }
}
