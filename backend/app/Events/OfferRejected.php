<?php

namespace App\Events;

class OfferRejected extends NegotiationOfferEvent
{
    public function broadcastAs(): string
    {
        return 'offer.rejected';
    }
}
