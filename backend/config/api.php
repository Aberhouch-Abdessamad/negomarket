<?php

return [

    /*
    |--------------------------------------------------------------------------
    | API Request Logging
    |--------------------------------------------------------------------------
    |
    | When enabled, every /api request is written to the default log channel
    | (storage/logs/laravel.log) with method, path, status, duration and the
    | authenticated user. Handy while wiring Postman/curl/mobile clients;
    | keep it off in production because it is noisy.
    |
    */

    'log_requests' => (bool) env('LOG_API_REQUESTS', false),

];
