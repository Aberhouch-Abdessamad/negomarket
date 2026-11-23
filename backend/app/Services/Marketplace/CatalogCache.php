<?php

namespace App\Services\Marketplace;

use Closure;
use Illuminate\Support\Facades\Cache;

/**
 * Versioned cache for PUBLIC catalog data only (never user-specific data).
 * Any product/store/category change bumps the version, which invalidates
 * every key at once without needing cache tags (works with the database driver).
 */
class CatalogCache
{
    private const VERSION_KEY = 'catalog:version';

    /**
     * Values are stored as JSON so the cache only ever holds plain data: nested
     * API resources are fully serialised and nothing is unserialised as objects.
     */
    public function remember(string $key, int $ttlSeconds, Closure $callback): mixed
    {
        $json = Cache::remember(
            "catalog:v{$this->version()}:{$key}",
            $ttlSeconds,
            fn () => json_encode($callback(), JSON_THROW_ON_ERROR | JSON_PRESERVE_ZERO_FRACTION),
        );

        return json_decode((string) $json, true, flags: JSON_THROW_ON_ERROR);
    }

    public function flush(): void
    {
        Cache::forever(self::VERSION_KEY, $this->version() + 1);
    }

    private function version(): int
    {
        return (int) Cache::rememberForever(self::VERSION_KEY, fn () => 1);
    }
}
