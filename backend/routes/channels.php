<?php

use App\Models\Negotiation;
use Illuminate\Support\Facades\Broadcast;

/*
| Private channel authorization.
| Clients subscribe as "private-users.{id}" and "private-negotiations.{id}".
| Only the customer and the store owner of a negotiation may join its thread.
*/

Broadcast::channel('users.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

Broadcast::channel('negotiations.{negotiationId}', function ($user, $negotiationId) {
    $negotiation = Negotiation::query()->with('store')->find($negotiationId);

    return $negotiation !== null && $negotiation->isParticipant($user);
});
