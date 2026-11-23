<?php

namespace Database\Factories;

use App\Models\Dispute;
use App\Models\DisputeMessage;
use Database\Factories\Concerns\ResolvesModels;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<DisputeMessage>
 */
class DisputeMessageFactory extends Factory
{
    use ResolvesModels;

    protected $model = DisputeMessage::class;

    public function definition(): array
    {
        return [
            'dispute_id' => Dispute::factory(),
            'sender_id' => fn (array $attributes) => self::resolve(Dispute::class, $attributes['dispute_id'])->opened_by,
            'message' => fake()->sentence(),
        ];
    }
}
