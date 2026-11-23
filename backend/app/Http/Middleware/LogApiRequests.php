<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

/**
 * Writes one line per API request to the application log (storage/logs/laravel.log):
 * method, path, status, duration and who made it (bearer token vs session).
 *
 * Disabled by default; enable with LOG_API_REQUESTS=true. Secrets are never
 * logged: only the token id and the user, never the Authorization header.
 */
class LogApiRequests
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! config('api.log_requests')) {
            return $next($request);
        }

        $startedAt = hrtime(true);

        $response = $next($request);

        $user = $request->user();
        $token = $request->bearerToken();

        Log::info('api.request', [
            'method' => $request->method(),
            'path' => $request->path(),
            'status' => $response->getStatusCode(),
            'duration_ms' => round((hrtime(true) - $startedAt) / 1_000_000, 2),
            'user_id' => $user?->getKey(),
            'user_email' => $user?->email,
            'auth' => $token ? 'token' : ($user ? 'session' : 'guest'),
            'token_id' => $token ? $user?->currentAccessToken()?->getKey() : null,
            'ip' => $request->ip(),
        ]);

        return $response;
    }
}
