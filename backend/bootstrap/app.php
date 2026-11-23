<?php

use App\Http\Middleware\EnsureApprovedSeller;
use App\Http\Middleware\EnsureUserIsActive;
use App\Http\Middleware\LogApiRequests;
use App\Http\Responses\ApiResponse;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Spatie\Permission\Exceptions\UnauthorizedException as PermissionDeniedException;
use Spatie\Permission\Middleware\PermissionMiddleware;
use Spatie\Permission\Middleware\RoleMiddleware;
use Spatie\Permission\Middleware\RoleOrPermissionMiddleware;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withBroadcasting(
        __DIR__.'/../routes/channels.php',
        ['prefix' => 'api', 'middleware' => ['api', 'auth:sanctum']],
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Sanctum SPA (cookie) authentication for the first-party React app.
        $middleware->statefulApi();
        // Named "api" rate limiter is defined in AppServiceProvider.
        $middleware->throttleApi();

        // One log line per API request (including 401/403/422/429); enable with LOG_API_REQUESTS=true.
        $middleware->api(prepend: [LogApiRequests::class]);

        $middleware->alias([
            'role' => RoleMiddleware::class,
            'permission' => PermissionMiddleware::class,
            'role_or_permission' => RoleOrPermissionMiddleware::class,
            'active' => EnsureUserIsActive::class,
            'seller.approved' => EnsureApprovedSeller::class,
        ]);

        // API-only backend: unauthenticated users get a JSON 401, never a redirect.
        $middleware->redirectGuestsTo(fn () => null);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $isApi = fn (Request $request) => $request->is('api/*') || $request->expectsJson();

        $exceptions->shouldRenderJsonWhen($isApi);

        // Consistent, safe JSON error envelope for every API error.
        $exceptions->render(function (Throwable $e, Request $request) use ($isApi) {
            if (! $isApi($request)) {
                return null;
            }

            return match (true) {
                $e instanceof ValidationException => ApiResponse::error('The given data was invalid.', 422, $e->errors()),
                $e instanceof AuthenticationException => ApiResponse::error('Unauthenticated.', 401),
                $e instanceof AuthorizationException,
                $e instanceof AccessDeniedHttpException => ApiResponse::error($e->getMessage() ?: 'This action is unauthorized.', 403),
                $e instanceof PermissionDeniedException => ApiResponse::error('This action is unauthorized.', 403),
                $e instanceof ModelNotFoundException,
                $e instanceof NotFoundHttpException => ApiResponse::error('Resource not found.', 404),
                $e instanceof ThrottleRequestsException => ApiResponse::error('Too many requests. Please slow down.', 429),
                $e instanceof HttpExceptionInterface => ApiResponse::error($e->getMessage() ?: 'Request error.', $e->getStatusCode()),
                default => config('app.debug') ? null : ApiResponse::error('Server error.', 500),
            };
        });
    })->create();
