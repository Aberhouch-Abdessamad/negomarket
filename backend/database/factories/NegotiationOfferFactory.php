<?php

namespace Database\Factories;

use App\Enums\OfferSenderRole;
use App\Enums\OfferStatus;
use App\Models\Negotiation;
use App\Models\NegotiationOffer;
use Database\Factories\Concerns\ResolvesModels;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<NegotiationOffer>
 */
class NegotiationOfferFactory extends Factory
{
    use ResolvesModels;

    protected $model = NegotiationOffer::class;

    public function definition(): array
    {
        return [
            'negotiation_id' => Negotiation::factory(),
            'sender_id' => fn (array $attributes) => self::resolve(Negotiation::class, $attributes['negotiation_id'])->customer_id,
            'sender_role' => OfferSenderRole::Customer,
            'amount' => fake()->randomFloat(2, 50, 1000),
            'status' => OfferStatus::Pending,
            'message' => fake()->optional()->sentence(),
            'expires_at' => now()->addHours(48),
        ];
    }

    public function fromSeller(): static
    {
        return $this->state([
            'sender_role' => OfferSenderRole::Seller,
            // Lazy: evaluated after ->for() has set the final negotiation.
            'sender_id' => fn (array $attributes) => self::resolve(Negotiation::class, $attributes['negotiation_id'], ['store'])->store->user_id,
        ]);
    }

    public function status(OfferStatus $status): static
    {
        return $this->state(fn () => [
            'status' => $status,
            'responded_at' => $status === OfferStatus::Pending ? null : now(),
        ]);
    }

    public function expired(): static
    {
        return $this->state(['expires_at' => now()->subHour()]);
    }
}
