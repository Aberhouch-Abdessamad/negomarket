<?php

namespace App\Services\Admin;

use App\Models\ActivityLog;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;

/** Paginated audit trail for the admin activity-log screen. */
class ActivityLogService
{
    /** @param array<string, mixed> $filters */
    public function index(array $filters): LengthAwarePaginator
    {
        return ActivityLog::query()
            ->when($filters['action'] ?? null, fn (Builder $q, string $action) => $q->where('action', $action))
            ->when($filters['user_id'] ?? null, fn (Builder $q, int $userId) => $q->where('user_id', $userId))
            ->when($filters['subject_type'] ?? null, fn (Builder $q, string $type) => $q->where('subject_type', $type))
            ->when($filters['from'] ?? null, fn (Builder $q, string $from) => $q->where('created_at', '>=', $from.' 00:00:00'))
            ->when($filters['to'] ?? null, fn (Builder $q, string $to) => $q->where('created_at', '<=', $to.' 23:59:59'))
            ->when($filters['q'] ?? null, function (Builder $q, string $term) {
                $like = '%'.addcslashes($term, '\\%_').'%';
                $q->whereHas('user', fn (Builder $u) => $u
                    ->where('name', 'like', $like)
                    ->orWhere('email', 'like', $like));
            })
            ->with('user:id,name,email')
            ->latest('id')
            ->paginate($filters['per_page'] ?? 30);
    }
}
