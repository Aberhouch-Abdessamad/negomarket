<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Laravel\Sanctum\PersonalAccessToken;

/**
 * Mints a Sanctum bearer token for an existing account so the API can be
 * exercised with curl, Postman or a mobile client instead of the SPA cookie.
 * The token inherits the user's roles and permissions, so it works on every
 * protected route that account is allowed to use.
 */
class IssueApiToken extends Command
{
    protected $signature = 'api:token
        {email : E-mail address of an existing user}
        {--name=cli : Token name / device label}
        {--days= : Expire the token after this many days (default: never)}';

    protected $description = 'Issue a Sanctum bearer token for a user (for Postman, curl or mobile clients)';

    public function handle(): int
    {
        $user = User::where('email', strtolower(trim((string) $this->argument('email'))))->first();

        if (! $user) {
            $this->error('No user found with that e-mail address.');

            return self::FAILURE;
        }

        if (! $user->isActive()) {
            $this->error("The account is {$user->status->value}; tokens can only be issued to active accounts.");

            return self::FAILURE;
        }

        $expiresAt = $this->option('days') !== null
            ? now()->addDays((int) $this->option('days'))
            : null;

        $token = $user->createToken((string) $this->option('name'), ['*'], $expiresAt);

        /** @var PersonalAccessToken $record */
        $record = $token->accessToken;

        Log::info('api.token.issued', [
            'token_id' => $record->getKey(),
            'token_name' => $record->name,
            'user_id' => $user->id,
            'email' => $user->email,
            'roles' => $user->getRoleNames()->all(),
            'expires_at' => $expiresAt?->toIso8601String(),
            'source' => 'artisan',
        ]);

        $this->newLine();
        $this->line("User:    {$user->name} <{$user->email}>");
        $this->line('Roles:   '.$user->getRoleNames()->implode(', '));
        $this->line('Expires: '.($expiresAt?->toDateTimeString() ?? 'never'));
        $this->newLine();
        $this->info('Bearer token (copy it now, it is not stored in plain text):');
        $this->line($token->plainTextToken);
        $this->newLine();
        $this->comment('Use it on any protected endpoint, e.g.:');
        $this->line('  curl -H "Authorization: Bearer '.$token->plainTextToken.'" -H "Accept: application/json" \\');
        $this->line('       '.config('app.url').'/api/v1/auth/me');
        $this->newLine();
        $this->comment('Revoke token #'.$record->id.' later with:');
        $this->line('  php artisan tinker --execute="Laravel\\Sanctum\\PersonalAccessToken::find('.$record->id.')->delete();"');

        return self::SUCCESS;
    }
}
