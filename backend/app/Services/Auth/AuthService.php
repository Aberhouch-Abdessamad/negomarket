<?php

namespace App\Services\Auth;

use App\Enums\UserStatus;
use App\Models\User;
use App\Services\Audit\ActivityLogger;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\NewAccessToken;

/**
 * Session (Sanctum SPA) authentication. Controllers stay thin; all auth rules live here.
 */
class AuthService
{
    public function __construct(
        private readonly ActivityLogger $activity,
        private readonly Request $request,
    ) {}

    /** @param array{name: string, email: string, password: string, phone?: string|null} $data */
    public function register(array $data, Request $request): User
    {
        $user = DB::transaction(function () use ($data) {
            $user = User::create([
                'name' => $data['name'],
                'email' => $data['email'],
                'phone' => $data['phone'] ?? null,
                'password' => $data['password'],
            ]);
            // Email verification is not used: accounts are ready immediately.
            $user->forceFill(['email_verified_at' => now()])->save();
            // Every account starts as a customer; the seller role is granted on application approval.
            $user->assignRole('customer');

            return $user;
        });

        $this->startSession($user, false, $request);
        $this->activity->log('auth.registered', $user, $user);

        return $user;
    }

    /**
     * @throws ValidationException|AuthorizationException
     */
    public function login(string $email, string $password, bool $remember, Request $request): User
    {
        $guard = Auth::guard('web');

        if (! $guard->validate(['email' => $email, 'password' => $password])) {
            $this->activity->log('auth.login_failed', null, null, ['email' => $email]);

            throw ValidationException::withMessages(['email' => __('auth.failed')]);
        }

        /** @var User $user */
        $user = $guard->getProvider()->retrieveByCredentials(['email' => $email]);

        if ($user->status !== UserStatus::Active) {
            $this->activity->log('auth.login_blocked', $user, $user, ['reason' => $user->status->value]);

            throw new AuthorizationException('Your account has been suspended. Please contact support.');
        }

        $this->startSession($user, $remember, $request);
        $this->activity->log('auth.login', $user, $user);

        return $user;
    }

    /**
     * Bearer-token login for non-browser clients (curl, Postman, mobile).
     * The token carries the user's roles and permissions, so it is accepted by
     * every "auth:sanctum" route the account is authorized for.
     *
     * @return array{user: User, token: NewAccessToken}
     *
     * @throws ValidationException|AuthorizationException
     */
    public function issueToken(string $email, string $password, string $deviceName): array
    {
        $user = User::where('email', $email)->first();

        if (! $user || ! Hash::check($password, $user->password)) {
            $this->activity->log('auth.login_failed', null, null, ['email' => $email, 'via' => 'token']);
            Log::warning('api.token.rejected', [
                'email' => $email,
                'reason' => 'invalid_credentials',
                'ip' => $this->request->ip(),
            ]);

            throw ValidationException::withMessages(['email' => __('auth.failed')]);
        }

        if ($user->status !== UserStatus::Active) {
            $this->activity->log('auth.login_blocked', $user, $user, [
                'reason' => $user->status->value,
                'via' => 'token',
            ]);
            Log::warning('api.token.rejected', [
                'email' => $email,
                'user_id' => $user->id,
                'reason' => $user->status->value,
                'ip' => $this->request->ip(),
            ]);

            throw new AuthorizationException('Your account has been suspended. Please contact support.');
        }

        $token = $user->createToken($deviceName, ['*']);

        $user->forceFill(['last_seen_at' => now()])->saveQuietly();
        $this->activity->log('auth.token_issued', $user, $user, ['device' => $deviceName]);

        // The plain-text token is never logged: only its id, name and owner.
        Log::info('api.token.issued', [
            'token_id' => $token->accessToken->getKey(),
            'token_name' => $deviceName,
            'user_id' => $user->id,
            'email' => $user->email,
            'roles' => $user->getRoleNames()->all(),
            'expires_at' => $token->accessToken->expires_at?->toIso8601String(),
            'ip' => $this->request->ip(),
            'user_agent' => Str::limit((string) $this->request->userAgent(), 120),
        ]);

        return ['user' => $user, 'token' => $token];
    }

    public function logout(Request $request): void
    {
        $user = $request->user();

        Auth::guard('web')->logout();
        if ($request->hasSession()) {
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        if ($user instanceof User) {
            $this->activity->log('auth.logout', $user, $user);
        }
    }

    /**
     * Always returns successfully to avoid account enumeration.
     */
    public function sendPasswordResetLink(string $email): void
    {
        $status = Password::broker()->sendResetLink(['email' => $email]);

        if ($status === Password::RESET_THROTTLED) {
            throw ValidationException::withMessages(['email' => __($status)]);
        }
    }

    /** @throws ValidationException */
    public function resetPassword(string $email, string $token, string $password): void
    {
        $status = Password::broker()->reset(
            ['email' => $email, 'token' => $token, 'password' => $password],
            function (User $user, string $password) {
                $user->forceFill([
                    'password' => $password,
                    'remember_token' => Str::random(60),
                ])->save();

                event(new PasswordReset($user));
                $this->activity->log('auth.password_reset', $user, $user);
            },
        );

        if ($status !== Password::PASSWORD_RESET) {
            throw ValidationException::withMessages(['email' => __($status)]);
        }
    }

    private function startSession(User $user, bool $remember, Request $request): void
    {
        Auth::guard('web')->login($user, $remember);

        if ($request->hasSession()) {
            $request->session()->regenerate(); // prevents session fixation
        }

        $user->forceFill(['last_seen_at' => now()])->saveQuietly();
    }
}
