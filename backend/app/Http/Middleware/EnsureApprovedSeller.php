<?php

namespace App\Http\Middleware;

use App\Http\Responses\ApiResponse;
use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Seller area guard: the user needs the "seller" role AND an active (approved) store.
 * Ownership of individual records is still checked by policies.
 */
class EnsureApprovedSeller
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user instanceof User || ! $user->isApprovedSeller()) {
            return ApiResponse::error('An approved, active store is required for this action.', 403);
        }

        return $next($request);
    }
}
