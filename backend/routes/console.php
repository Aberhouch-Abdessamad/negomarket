<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Phase 6: close expired offers and missed accepted-checkout windows.
Schedule::command('negotiations:expire')->everyFifteenMinutes()->withoutOverlapping();
