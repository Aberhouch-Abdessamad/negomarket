<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * E-mail verification is no longer used. Accounts created before this change
 * may still have a NULL email_verified_at; mark them verified so no one needs
 * a verification link (and so the account badge stays accurate).
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('users')
            ->whereNull('email_verified_at')
            ->update(['email_verified_at' => now()]);
    }

    public function down(): void
    {
        // Cannot know which accounts were originally unverified; leave as is.
    }
};
