<?php

namespace App\Events;

class OfferAccepted extends NegotiationOfferEvent
{
    public function broadcastAs(): string
    {
        return 'offer.accepted';
    }
}
