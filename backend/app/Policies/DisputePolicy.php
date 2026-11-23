<?php

namespace App\Policies;

use App\Enums\DisputeStatus;
use App\Models\Dispute;
use App\Models\User;

/** A dispute is visible to the customer, the store owner and dispute managers. */
class DisputePolicy
{
    public function view(User $user, Dispute $dispute): bool
    {
        return $this->isParticipant($user, $dispute) || $user->hasPermissionTo('disputes.manage');
    }

    public function message(User $user, Dispute $dispute): bool
    {
        return $this->isParticipant($user, $dispute)
            && in_array($dispute->status, [DisputeStatus::Open, DisputeStatus::UnderReview], true);
    }

    public function resolve(User $user, Dispute $dispute): bool
    {
        return $user->hasPermissionTo('disputes.manage');
    }

    private function isParticipant(User $user, Dispute $dispute): bool
    {
        if ((int) $dispute->opened_by === (int) $user->id) {
            return true;
        }

        return $dispute->order()->whereHas('store', fn ($q) => $q->where('user_id', $user->id))->exists();
    }
}
