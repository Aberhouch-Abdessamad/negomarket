<?php

namespace Database\Factories;

use App\Enums\NegotiationStatus;
use App\Models\Negotiation;
use App\Models\Product;
use App\Models\User;
use Database\Factories\Concerns\ResolvesModels;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Negotiation>
 */
class NegotiationFactory extends Factory
{
    use ResolvesModels;

    protected $model = Negotiation::class;

    public function definition(): array
    {
        return [
            'product_id' => Product::factory()->published()->negotiable(),
            'store_id' => fn (array $attributes) => self::resolve(Product::class, $attributes['product_id'])->store_id,
            'customer_id' => User::factory(),
            'quantity' => 1,
            'status' => NegotiationStatus::Active,
            'expires_at' => now()->addDays(7),
            'last_activity_at' => now(),
        ];
    }

    public function forProduct(Product $product): static
    {
        return $this->state(['product_id' => $product->id, 'store_id' => $product->store_id]);
    }

    public function status(NegotiationStatus $status): static
    {
        return $this->state(fn () => [
            'status' => $status,
            'closed_at' => $status === NegotiationStatus::Active ? null : now(),
        ]);
    }
}
