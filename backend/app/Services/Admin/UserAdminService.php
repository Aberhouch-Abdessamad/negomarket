<?php

namespace App\Services\Admin;

use App\Enums\UserStatus;
use App\Models\User;
use App\Services\Audit\ActivityLogger;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Validation\ValidationException;

/** Administrative user management: browse accounts and suspend/restore them. */
class UserAdminService
{
    public function __construct(private readonly ActivityLogger $activity) {}

    /** @param array<string, mixed> $filters */
    public function index(array $filters): LengthAwarePaginator
    {
        return User::query()
            ->when($filters['status'] ?? null, fn (Builder $q, string $status) => $q->where('status', $status))
            ->when($filters['role'] ?? null, fn (Builder $q, string $role) => $q->role($role))
            ->when($filters['q'] ?? null, function (Builder $q, string $term) {
                $like = '%'.addcslashes($term, '\\%_').'%';
                $q->where(fn (Builder $w) => $w
                    ->where('name', 'like', $like)
                    ->orWhere('email', 'like', $like)
                    ->orWhere('phone', 'like', $like));
            })
            ->with(['roles:id,name', 'store:id,user_id,name,slug,status'])
            ->withCount(['orders', 'reviews', 'negotiations'])
            ->latest('id')
            ->paginate($filters['per_page'] ?? 20);
    }

    public function show(User $user): User
    {
        return $user->load(['roles:id,name', 'store:id,user_id,name,slug,status,approved_at'])
            ->loadCount(['orders', 'reviews', 'negotiations', 'activityLogs']);
    }

    /** Suspending an account revokes every API token immediately. */
    public function updateStatus(User $actor, User $user, UserStatus $status): User
    {
        if ((int) $actor->id === (int) $user->id) {
            throw ValidationException::withMessages([
                'status' => ['You cannot change the status of your own account.'],
            ]);
        }

        if ($user->hasRole('admin') && $status === UserStatus::Suspended) {
            throw ValidationException::withMessages([
                'status' => ['Administrator accounts cannot be suspended from the panel.'],
            ]);
        }

        $previous = $user->status;
        $user->forceFill(['status' => $status])->save();

        if ($status === UserStatus::Suspended) {
            $user->tokens()->delete();
        }

        $this->activity->log('user.status_changed', $actor, $user, [
            'from' => $previous->value,
            'to' => $status->value,
        ]);

        return $this->show($user->fresh());
    }
}
