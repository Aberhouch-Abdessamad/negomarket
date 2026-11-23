<?php

namespace App\Services\Account;

use App\Models\User;
use App\Services\Audit\ActivityLogger;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class ProfileService
{
    public function __construct(private readonly ActivityLogger $activity) {}

    /** @param array{name: string, email: string, phone?: string|null} $data */
    public function update(User $user, array $data): User
    {
        $emailChanged = $user->email !== $data['email'];

        $user->fill($data);
        $user->save();

        $this->activity->log('profile.updated', $user, $user, ['email_changed' => $emailChanged]);

        return $user;
    }

    public function updatePassword(User $user, string $password, Request $request): void
    {
        $user->forceFill(['password' => $password, 'remember_token' => Str::random(60)])->save();

        // Keep the current session valid but rotate its id.
        if ($request->hasSession()) {
            $request->session()->regenerate();
        }

        // Sign out other browsers: drop their database sessions and API tokens.
        if (config('session.driver') === 'database') {
            DB::table(config('session.table', 'sessions'))
                ->where('user_id', $user->id)
                ->when($request->hasSession(), fn ($q) => $q->where('id', '!=', $request->session()->getId()))
                ->delete();
        }
        $user->tokens()->delete();

        $this->activity->log('profile.password_changed', $user, $user);
    }

    public function updateAvatar(User $user, UploadedFile $file): User
    {
        // Random file name; extension derived from the sniffed MIME type, never from the client name.
        $path = $file->storeAs('avatars/'.$user->id, Str::uuid().'.'.$file->extension(), 'public');

        $old = $user->avatar_path;
        $user->forceFill(['avatar_path' => $path])->save();

        if ($old && $old !== $path) {
            Storage::disk('public')->delete($old);
        }

        return $user;
    }

    public function removeAvatar(User $user): User
    {
        if ($user->avatar_path) {
            Storage::disk('public')->delete($user->avatar_path);
            $user->forceFill(['avatar_path' => null])->save();
        }

        return $user;
    }
}
