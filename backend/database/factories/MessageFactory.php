<?php

namespace Database\Factories;

use App\Enums\MessageType;
use App\Models\Message;
use App\Models\Negotiation;
use Database\Factories\Concerns\ResolvesModels;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Message>
 */
class MessageFactory extends Factory
{
    use ResolvesModels;

    protected $model = Message::class;

    public function definition(): array
    {
        return [
            'negotiation_id' => Negotiation::factory(),
            'sender_id' => fn (array $attributes) => self::resolve(Negotiation::class, $attributes['negotiation_id'])->customer_id,
            'message' => fake()->sentence(),
            'message_type' => MessageType::Text,
            'client_message_id' => (string) Str::uuid(),
        ];
    }
}
