<?php

namespace App\Policies;

use App\Enums\NegotiationStatus;
use App\Models\Negotiation;
use App\Models\User;

/** Only the two participants (customer and store owner) can see or act on a negotiation. */
class NegotiationPolicy
{
    public function view(User $user, Negotiation $negotiation): bool
    {
        return $negotiation->isParticipant($user);
    }

    public function message(User $user, Negotiation $negotiation): bool
    {
        return $negotiation->isParticipant($user);
    }

    public function respond(User $user, Negotiation $negotiation): bool
    {
        return $negotiation->isParticipant($user);
    }

    public function cancel(User $user, Negotiation $negotiation): bool
    {
        return $negotiation->isParticipant($user)
            && ! in_array($negotiation->status, [NegotiationStatus::ConvertedToOrder, NegotiationStatus::Expired, NegotiationStatus::Cancelled, NegotiationStatus::Rejected], true);
    }

    public function monitor(User $user): bool
    {
        return $user->hasPermissionTo('negotiations.monitor');
    }
}
