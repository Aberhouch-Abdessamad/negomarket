<?php

namespace Tests\Feature\Auth;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Tests\Concerns\ActsAsSpa;
use Tests\Concerns\MakesImages;
use Tests\TestCase;

class ProfileTest extends TestCase
{
    use ActsAsSpa, MakesImages, RefreshDatabase;

    public function test_user_can_update_profile(): void
    {
        $user = $this->customer();

        $this->actingAs($user)->putJson('/api/v1/profile', ['name' => 'New Name', 'email' => $user->email, 'phone' => '+212 612345678'])
            ->assertOk()
            ->assertJsonPath('data.name', 'New Name')
            ->assertJsonPath('data.email_verified', true);
    }

    public function test_changing_email_keeps_the_account_verified(): void
    {
        $user = $this->customer();

        $this->actingAs($user)->putJson('/api/v1/profile', ['name' => $user->name, 'email' => 'new@example.com'])
            ->assertOk()
            ->assertJsonPath('data.email', 'new@example.com')
            ->assertJsonPath('data.email_verified', true);

        $this->assertNotNull($user->fresh()->email_verified_at);
    }

    public function test_email_must_stay_unique(): void
    {
        $other = $this->customer();
        $user = $this->customer();

        $this->actingAs($user)->putJson('/api/v1/profile', ['name' => 'X Y', 'email' => $other->email])
            ->assertJsonValidationErrors('email');
    }

    public function test_user_can_change_password_with_current_password(): void
    {
        $user = $this->customer();

        $this->actingAs($user)->putJson('/api/v1/profile/password', [
            'current_password' => 'wrong', 'password' => 'newpass123', 'password_confirmation' => 'newpass123',
        ])->assertJsonValidationErrors('current_password');

        $this->actingAs($user)->putJson('/api/v1/profile/password', [
            'current_password' => 'password', 'password' => 'password', 'password_confirmation' => 'password',
        ])->assertJsonValidationErrors('password');

        $this->actingAs($user)->putJson('/api/v1/profile/password', [
            'current_password' => 'password', 'password' => 'newpass123', 'password_confirmation' => 'newpass123',
        ])->assertOk();

        $this->assertTrue(Hash::check('newpass123', $user->fresh()->password));
    }

    public function test_avatar_upload_accepts_images_and_rejects_other_files(): void
    {
        Storage::fake('public');
        $user = $this->customer();

        $response = $this->actingAs($user)->post('/api/v1/profile/avatar', ['avatar' => $this->image('me.png', 200, 200)])
            ->assertOk();
        $path = $user->fresh()->avatar_path;
        Storage::disk('public')->assertExists($path);
        $this->assertStringStartsWith("avatars/{$user->id}/", $path);
        $this->assertStringEndsWith('.png', $path);
        $this->assertNotNull($response->json('data.avatar_url'));

        foreach ([
            UploadedFile::fake()->create('evil.php', 10, 'application/x-php'),
            UploadedFile::fake()->create('img.svg', 10, 'image/svg+xml'),
            $this->image('huge.jpg', 200, 200, 3000),
            $this->image('tiny.png', 10, 10),
        ] as $file) {
            $this->actingAs($user)->post('/api/v1/profile/avatar', ['avatar' => $file])->assertJsonValidationErrors('avatar');
        }

        $this->actingAs($user)->deleteJson('/api/v1/profile/avatar')->assertOk()->assertJsonPath('data.avatar_url', null);
        Storage::disk('public')->assertMissing($path);
    }
}
