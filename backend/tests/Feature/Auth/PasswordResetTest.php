<?php

namespace Tests\Feature\Auth;

use App\Notifications\Auth\ResetPasswordNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Tests\Concerns\ActsAsSpa;
use Tests\TestCase;

class PasswordResetTest extends TestCase
{
    use ActsAsSpa, RefreshDatabase;

    public function test_full_password_reset_flow(): void
    {
        Notification::fake();
        $user = $this->customer(['email' => 'reset@example.com']);

        $this->postJson('/api/v1/auth/forgot-password', ['email' => 'reset@example.com'])->assertOk();

        $token = null;
        Notification::assertSentTo($user, ResetPasswordNotification::class, function ($n) use ($user, &$token) {
            $token = $n->token;
            $this->assertStringStartsWith('http://localhost:5173/reset-password?token=', $n->toMail($user)->actionUrl);

            return true;
        });

        $this->postJson('/api/v1/auth/reset-password', [
            'token' => $token, 'email' => 'reset@example.com',
            'password' => 'newpass123', 'password_confirmation' => 'newpass123',
        ])->assertOk();

        $this->assertTrue(Hash::check('newpass123', $user->fresh()->password));

        // Token is single-use.
        $this->postJson('/api/v1/auth/reset-password', [
            'token' => $token, 'email' => 'reset@example.com',
            'password' => 'another123', 'password_confirmation' => 'another123',
        ])->assertUnprocessable()->assertJsonValidationErrors('email');
    }

    public function test_forgot_password_does_not_reveal_whether_an_account_exists(): void
    {
        Notification::fake();

        $this->postJson('/api/v1/auth/forgot-password', ['email' => 'ghost@example.com'])
            ->assertOk()
            ->assertJsonPath('message', 'If an account exists for that email, a password reset link has been sent.');
        Notification::assertNothingSent();
    }

    public function test_invalid_token_is_rejected(): void
    {
        $user = $this->customer();

        $this->postJson('/api/v1/auth/reset-password', [
            'token' => 'invalid', 'email' => $user->email,
            'password' => 'newpass123', 'password_confirmation' => 'newpass123',
        ])->assertUnprocessable();
        $this->assertTrue(Hash::check('password', $user->fresh()->password));
    }
}
