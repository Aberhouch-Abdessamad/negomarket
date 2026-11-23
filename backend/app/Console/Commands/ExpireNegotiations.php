<?php

namespace App\Console\Commands;

use App\Services\Negotiation\NegotiationService;
use Illuminate\Console\Command;

/**
 * Closes expired pending offers and accepted negotiations whose checkout
 * window has passed. Scheduled every fifteen minutes; safe to run manually.
 */
class ExpireNegotiations extends Command
{
    protected $signature = 'negotiations:expire';

    protected $description = 'Expire stale negotiation offers and accepted negotiations';

    public function handle(NegotiationService $negotiations): int
    {
        $count = $negotiations->expireStale();

        $this->info("Expired {$count} negotiation(s).");

        return self::SUCCESS;
    }
}
