<?php

namespace App\Observers;

use App\Services\Marketplace\CatalogCache;

/** Invalidates cached public catalog data whenever catalog models change. */
class CatalogChangeObserver
{
    public function __construct(private readonly CatalogCache $cache) {}

    public function saved(): void
    {
        $this->cache->flush();
    }

    public function deleted(): void
    {
        $this->cache->flush();
    }

    public function restored(): void
    {
        $this->cache->flush();
    }
}
