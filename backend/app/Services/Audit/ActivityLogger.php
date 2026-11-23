<?php

namespace App\Services\Audit;

use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;

/**
 * Records important actions in activity_logs. Never pass secrets in $properties.
 */
class ActivityLogger
{
    public function __construct(private readonly Request $request) {}

    /** @param array<string, mixed> $properties */
    public function log(string $action, ?User $actor = null, ?Model $subject = null, array $properties = []): ActivityLog
    {
        $log = new ActivityLog;
        $log->forceFill([
            'user_id' => $actor?->id,
            'action' => $action,
            'subject_type' => $subject?->getMorphClass(),
            'subject_id' => $subject?->getKey(),
            'properties' => $properties ?: null,
            'ip_address' => $this->request->ip(),
            'user_agent' => mb_substr((string) $this->request->userAgent(), 0, 512) ?: null,
        ])->save();

        return $log;
    }
}
