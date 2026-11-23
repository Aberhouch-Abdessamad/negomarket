<?php

namespace App\Events;

class OfferCreated extends NegotiationOfferEvent
{
    public function broadcastAs(): string
    {
        return 'offer.created';
    }
}
