<?php

namespace App\Services\Negotiation;

use App\Enums\MessageType;
use App\Enums\NegotiationStatus;
use App\Events\MessageSent;
use App\Models\Message;
use App\Models\Negotiation;
use App\Models\User;
use App\Notifications\NegotiationNotification;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/** Persists chat messages, tracks read state and broadcasts idempotently. */
class MessageService
{
    /** @param array<string, mixed> $data */
    public function send(User $sender, Negotiation $negotiation, array $data): Message
    {
        if (! $negotiation->isParticipant($sender)) {
            throw ValidationException::withMessages(['message' => 'You are not a participant in this conversation.']);
        }
        if (in_array($negotiation->status, [NegotiationStatus::Cancelled, NegotiationStatus::Rejected, NegotiationStatus::Expired], true)) {
            throw ValidationException::withMessages(['message' => 'This conversation is closed.']);
        }

        // Idempotency: the same sender + client UUID always resolves to one row.
        $existing = Message::query()
            ->where('sender_id', $sender->id)
            ->where('client_message_id', $data['client_message_id'])
            ->first();

        if ($existing) {
            if ((int) $existing->negotiation_id !== (int) $negotiation->id) {
                throw ValidationException::withMessages(['client_message_id' => 'This message id was already used.']);
            }

            return $existing;
        }

        $message = DB::transaction(function () use ($sender, $negotiation, $data) {
            $message = new Message;
            $message->forceFill([
                'negotiation_id' => $negotiation->id,
                'sender_id' => $sender->id,
                'message' => $data['message'],
                'message_type' => MessageType::Text,
                'client_message_id' => $data['client_message_id'],
            ])->save();

            $negotiation->forceFill(['last_activity_at' => now()])->save();

            return $message->load('sender');
        });

        $recipient = $negotiation->customer_id === $sender->id
            ? $negotiation->store?->owner
            : $negotiation->customer;

        $recipient?->notify(new NegotiationNotification(
            $negotiation, 'negotiation.message', 'New message',
            mb_strimwidth($data['message'], 0, 140, '…'),
        ));

        event(new MessageSent($message));

        return $message;
    }

    public function markRead(User $reader, Negotiation $negotiation): int
    {
        if (! $negotiation->isParticipant($reader)) {
            throw ValidationException::withMessages(['message' => 'You are not a participant in this conversation.']);
        }

        return Message::query()
            ->where('negotiation_id', $negotiation->id)
            ->where('sender_id', '!=', $reader->id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);
    }

    public function unreadCount(User $user, Negotiation $negotiation): int
    {
        return Message::query()
            ->where('negotiation_id', $negotiation->id)
            ->where('sender_id', '!=', $user->id)
            ->whereNull('read_at')
            ->count();
    }
}
