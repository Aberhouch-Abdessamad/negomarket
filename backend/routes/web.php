<?php

use Illuminate\Support\Facades\Route;

// The NegoMarket UI is the separate React SPA in /frontend. The backend only serves the API.
Route::get('/', fn () => response()->json([
    'app' => config('app.name'),
    'api' => url('/api/v1'),
]));
