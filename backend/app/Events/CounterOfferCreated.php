<?php

namespace App\Events;

class CounterOfferCreated extends NegotiationOfferEvent
{
    public function broadcastAs(): string
    {
        return 'counter_offer.created';
    }
}
