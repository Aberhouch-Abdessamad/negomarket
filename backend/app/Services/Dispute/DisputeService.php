<?php

namespace App\Services\Dispute;

use App\Enums\DisputeStatus;
use App\Models\Dispute;
use App\Models\DisputeMessage;
use App\Models\Order;
use App\Models\User;
use App\Notifications\Order\DisputeNotification;
use App\Services\Audit\ActivityLogger;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Post-delivery disputes. Customers open them, both sides can add messages,
 * and an administrator with disputes.manage changes the status.
 */
class DisputeService
{
    public function __construct(private readonly ActivityLogger $activity) {}

    /** @param array<string, mixed> $filters */
    public function index(User $user, array $filters): LengthAwarePaginator
    {
        return Dispute::query()
            ->when(! $user->hasPermissionTo('disputes.manage'), function (Builder $query) use ($user) {
                $query->where(fn (Builder $w) => $w
                    ->where('opened_by', $user->id)
                    ->orWhereHas('order', fn (Builder $o) => $o
                        ->whereHas('store', fn (Builder $s) => $s->where('user_id', $user->id))));
            })
            ->when($filters['status'] ?? null, fn (Builder $q, string $status) => $q->where('status', $status))
            ->when($filters['order_id'] ?? null, fn (Builder $q, int $orderId) => $q->where('order_id', $orderId))
            ->with($this->relations())
            ->latest('id')
            ->paginate($filters['per_page'] ?? 15);
    }

    public function show(Dispute $dispute): Dispute
    {
        return $dispute->load($this->relations());
    }

    /**
     * @param  array{reason: string, description: string}  $data
     *
     * @throws ValidationException
     */
    public function open(User $actor, Order $order, array $data): Dispute
    {
        $dispute = DB::transaction(function () use ($actor, $order, $data) {
            $active = Dispute::query()
                ->where('order_id', $order->id)
                ->whereIn('status', [DisputeStatus::Open, DisputeStatus::UnderReview])
                ->lockForUpdate()
                ->exists();

            if ($active) {
                throw ValidationException::withMessages([
                    'order' => ['This order already has an open dispute.'],
                ]);
            }

            $dispute = new Dispute;
            $dispute->forceFill([
                'order_id' => $order->id,
                'opened_by' => $actor->id,
                'reason' => $data['reason'],
                'description' => $data['description'],
                'status' => DisputeStatus::Open,
            ])->save();

            $message = new DisputeMessage;
            $message->forceFill([
                'dispute_id' => $dispute->id,
                'sender_id' => $actor->id,
                'message' => $data['description'],
            ])->save();

            return $dispute;
        });

        $this->activity->log('dispute.opened', $actor, $dispute, [
            'order_id' => $order->id,
            'reason' => $dispute->reason,
        ]);

        $dispute->load(['order.store.owner', 'opener']);
        $owner = $dispute->order?->store?->owner;
        if ($owner && (int) $owner->id !== (int) $actor->id) {
            $owner->notify(new DisputeNotification($dispute, 'opened', $dispute->description));
        }

        return $this->show($dispute->fresh());
    }

    /** @throws ValidationException */
    public function message(User $actor, Dispute $dispute, string $message): Dispute
    {
        if (! in_array($dispute->status, [DisputeStatus::Open, DisputeStatus::UnderReview], true)) {
            throw ValidationException::withMessages([
                'dispute' => ['This dispute is closed and can no longer receive messages.'],
            ]);
        }

        $created = new DisputeMessage;
        $created->forceFill([
            'dispute_id' => $dispute->id,
            'sender_id' => $actor->id,
            'message' => $message,
        ])->save();

        $this->activity->log('dispute.message', $actor, $dispute, [
            'message_id' => $created->id,
        ]);

        $dispute->load(['order.store.owner', 'opener']);
        $this->participants($dispute)
            ->reject(fn (User $user) => (int) $user->id === (int) $actor->id)
            ->each(fn (User $user) => $user->notify(new DisputeNotification($dispute, 'message', $message)));

        return $this->show($dispute->fresh());
    }

    /**
     * Administrator moderation.
     *
     * @throws ValidationException
     */
    public function resolve(User $actor, Dispute $dispute, DisputeStatus $status, ?string $resolution): Dispute
    {
        $dispute = DB::transaction(function () use ($actor, $dispute, $status, $resolution) {
            /** @var Dispute $locked */
            $locked = Dispute::query()->lockForUpdate()->findOrFail($dispute->id);

            if (in_array($locked->status, [DisputeStatus::Resolved, DisputeStatus::Rejected, DisputeStatus::Closed], true)) {
                throw ValidationException::withMessages([
                    'status' => ['This dispute is already closed.'],
                ]);
            }

            if (in_array($status, [DisputeStatus::Resolved, DisputeStatus::Rejected], true) && blank($resolution)) {
                throw ValidationException::withMessages([
                    'resolution' => ['A resolution message is required when resolving or rejecting a dispute.'],
                ]);
            }

            $terminal = in_array($status, [DisputeStatus::Resolved, DisputeStatus::Rejected, DisputeStatus::Closed], true);

            $locked->forceFill([
                'status' => $status,
                'resolution' => $resolution,
                'resolved_by' => $terminal ? $actor->id : null,
                'resolved_at' => $terminal ? now() : null,
            ])->save();

            return $locked;
        });

        $this->activity->log('dispute.'.$status->value, $actor, $dispute, [
            'resolution' => $resolution,
        ]);

        $dispute->load(['order.store.owner', 'opener']);
        $this->participants($dispute)
            ->each(fn (User $user) => $user->notify(new DisputeNotification(
                $dispute,
                'status',
                $resolution ?? $dispute->status->label(),
            )));

        return $this->show($dispute->fresh());
    }

    /** @return Collection<int, User> */
    private function participants(Dispute $dispute): Collection
    {
        return collect([$dispute->opener, $dispute->order?->store?->owner])
            ->filter(fn ($user) => $user instanceof User)
            ->unique('id')
            ->values();
    }

    /** @return array<int|string, mixed> */
    private function relations(): array
    {
        return [
            'order:id,reference_number,store_id,customer_id,status,total_amount,created_at',
            'order.store:id,name,slug,user_id',
            'opener:id,name',
            'resolver:id,name',
            'messages.sender:id,name',
        ];
    }
}
