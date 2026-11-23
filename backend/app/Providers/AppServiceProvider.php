<?php

namespace App\Providers;

use App\Models\Category;
use App\Models\Product;
use App\Models\ProductImage;
use App\Models\ProductVariant;
use App\Models\Store;
use App\Observers\CatalogChangeObserver;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        // Catch N+1 queries, silently discarded attributes and missing attributes during development.
        Model::shouldBeStrict(! $this->app->isProduction());

        foreach ([Product::class, ProductImage::class, ProductVariant::class, Store::class, Category::class] as $model) {
            $model::observe(CatalogChangeObserver::class);
        }

        // ApiResponse adds its own envelope.
        JsonResource::withoutWrapping();

        RateLimiter::for('api', function (Request $request) {
            return Limit::perMinute(120)->by($request->user()?->id ?: $request->ip());
        });

        // Password policy shared by registration, reset and password change.
        Password::defaults(function () {
            $rule = Password::min(8)->max(128)->letters()->numbers();

            return $this->app->isProduction() ? $rule->mixedCase()->uncompromised() : $rule;
        });

        // Stricter limiter for credential endpoints (used from Phase 3).
        RateLimiter::for('auth', function (Request $request) {
            return [
                Limit::perMinute(10)->by('auth-email:'.strtolower((string) $request->input('email')).'|'.$request->ip()),
                Limit::perMinute(30)->by('auth-ip:'.$request->ip()),
            ];
        });
    }
}
