<?php

namespace App\Services\Order;

use App\Enums\InventoryMovementType;
use App\Enums\OrderGroupStatus;
use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Models\Order;
use App\Models\OrderGroup;
use App\Models\OrderItem;
use App\Models\OrderStatusHistory;
use App\Models\Payment;
use App\Models\Store;
use App\Models\User;
use App\Notifications\Order\OrderStatusChangedNotification;
use App\Notifications\Order\PaymentCollectedNotification;
use App\Services\Audit\ActivityLogger;
use App\Services\Inventory\InventoryService;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Order lifecycle: seller fulfilment, customer cancellation and receipt,
 * COD collection, status history, group status roll-up and stock restore.
 *
 * Prices and totals are never accepted from the client. Status changes are
 * only allowed through OrderStatus::allowedTransitions(). Stock returns use
 * the inventory ledger's unique reference + type pair, so restoring twice is
 * impossible even under retries.
 */
class OrderService
{
    public function __construct(
        private readonly InventoryService $inventory,
        private readonly ActivityLogger $activity,
    ) {}

    /** @param array<string, mixed> $filters */
    public function customerOrders(User $user, array $filters): LengthAwarePaginator
    {
        return Order::query()
            ->where('customer_id', $user->id)
            ->when($filters['status'] ?? null, fn (Builder $q, string $status) => $q->where('status', $status))
            ->when($filters['store_id'] ?? null, fn (Builder $q, int $storeId) => $q->where('store_id', $storeId))
            ->with($this->listRelations())
            ->latest('id')
            ->paginate($filters['per_page'] ?? 15);
    }

    /** @param array<string, mixed> $filters */
    public function sellerOrders(Store $store, array $filters): LengthAwarePaginator
    {
        return Order::query()
            ->where('store_id', $store->id)
            ->when($filters['status'] ?? null, fn (Builder $q, string $status) => $q->where('status', $status))
            ->when($filters['q'] ?? null, function (Builder $q, string $term) {
                $like = '%'.addcslashes($term, '\\%_').'%';
                $q->where(fn (Builder $w) => $w
                    ->where('reference_number', 'like', $like)
                    ->orWhereHas('customer', fn (Builder $c) => $c
                        ->where('name', 'like', $like)
                        ->orWhere('email', 'like', $like)));
            })
            ->with($this->listRelations())
            ->latest('id')
            ->paginate($filters['per_page'] ?? 20);
    }

    /** Platform-wide order list for administrators. @param array<string, mixed> $filters */
    public function adminOrders(array $filters): LengthAwarePaginator
    {
        return Order::query()
            ->when($filters['status'] ?? null, fn (Builder $q, string $status) => $q->where('status', $status))
            ->when($filters['store_id'] ?? null, fn (Builder $q, int $storeId) => $q->where('store_id', $storeId))
            ->when($filters['customer_id'] ?? null, fn (Builder $q, int $customerId) => $q->where('customer_id', $customerId))
            ->when($filters['q'] ?? null, function (Builder $q, string $term) {
                $like = '%'.addcslashes($term, '\\%_').'%';
                $q->where(fn (Builder $w) => $w
                    ->where('reference_number', 'like', $like)
                    ->orWhereHas('customer', fn (Builder $c) => $c
                        ->where('name', 'like', $like)
                        ->orWhere('email', 'like', $like))
                    ->orWhereHas('store', fn (Builder $s) => $s->where('name', 'like', $like)));
            })
            ->with($this->listRelations())
            ->latest('id')
            ->paginate($filters['per_page'] ?? 20);
    }

    public function load(Order $order): Order
    {
        return $order->load([
            ...$this->listRelations(),
            'statusHistory.changedBy:id,name',
            'disputes' => fn ($q) => $q->latest('id'),
        ]);
    }

    public function loadGroup(OrderGroup $group): OrderGroup
    {
        return $group->load([
            'orders' => fn ($query) => $query->with($this->listRelations())->latest('id'),
        ]);
    }

    /**
     * Customer cancels before shipment; a seller may cancel until shipment.
     *
     * @throws ValidationException
     */
    public function cancel(User $actor, Order $order, ?string $reason, string $context = 'customer'): Order
    {
        $order = DB::transaction(function () use ($actor, $order, $reason, $context) {
            /** @var Order $locked */
            $locked = Order::query()->lockForUpdate()->findOrFail($order->id);

            $allowed = match ($context) {
                'seller' => in_array($locked->status, [OrderStatus::Pending, OrderStatus::Confirmed, OrderStatus::Processing], true),
                'admin' => ! in_array($locked->status, [OrderStatus::Cancelled, OrderStatus::Returned], true),
                default => $locked->status->isCancellableByCustomer(),
            };

            if (! $allowed) {
                throw ValidationException::withMessages([
                    'status' => ['This order can no longer be cancelled.'],
                ]);
            }

            $from = $locked->status;
            $this->restoreStock($locked, InventoryMovementType::CancellationRestore, $actor, 'Stock restored after cancellation');

            $locked->forceFill([
                'status' => OrderStatus::Cancelled,
                'cancelled_at' => now(),
                'cancelled_by' => $actor->id,
                'cancellation_reason' => $reason ?: match ($context) {
                    'seller' => 'Cancelled by the seller.',
                    'admin' => 'Cancelled by an administrator.',
                    default => 'Cancelled by the customer.',
                },
            ])->save();

            $this->recordHistory(
                $locked,
                $from,
                OrderStatus::Cancelled,
                $actor,
                $locked->cancellation_reason,
            );
            $this->syncGroupStatus($locked);

            return $locked;
        });

        $this->activity->log('order.cancelled', $actor, $order, [
            'reference' => $order->reference_number,
            'reason' => $order->cancellation_reason,
            'by' => $context,
        ]);

        $order->load(['customer', 'store.owner']);

        if ($context === 'customer') {
            $order->store?->owner?->notify(new OrderStatusChangedNotification($order, $order->status, $order->cancellation_reason));
        } else {
            $order->customer?->notify(new OrderStatusChangedNotification($order, $order->status, $order->cancellation_reason));
        }

        return $this->load($order->fresh());
    }

    /**
     * Seller fulfilment step. Cancellation must use cancel() so a reason is kept.
     *
     * @throws ValidationException
     */
    public function transition(User $actor, Order $order, OrderStatus $next, ?string $note = null): Order
    {
        if ($next === OrderStatus::Cancelled) {
            throw ValidationException::withMessages([
                'status' => ['Use the cancel endpoint so a cancellation reason is recorded.'],
            ]);
        }

        $order = DB::transaction(function () use ($actor, $order, $next, $note) {
            /** @var Order $locked */
            $locked = Order::query()->lockForUpdate()->findOrFail($order->id);

            if (! $locked->status->canTransitionTo($next)) {
                throw ValidationException::withMessages([
                    'status' => ["An order in \"{$locked->status->value}\" cannot move to \"{$next->value}\"."],
                ]);
            }

            $from = $locked->status;

            if ($next === OrderStatus::Returned) {
                $this->restoreStock($locked, InventoryMovementType::ReturnRestore, $actor, 'Stock restored after return');
            }

            $attributes = ['status' => $next];

            match ($next) {
                OrderStatus::Confirmed => $attributes['confirmed_at'] = now(),
                OrderStatus::Shipped => $attributes['shipped_at'] = now(),
                OrderStatus::Delivered => $attributes['delivered_at'] = now(),
                default => null,
            };

            $locked->forceFill($attributes)->save();

            $this->recordHistory($locked, $from, $next, $actor, $note);
            $this->syncGroupStatus($locked);

            return $locked;
        });

        $this->activity->log('order.status_changed', $actor, $order, [
            'reference' => $order->reference_number,
            'status' => $order->status->value,
            'note' => $note,
        ]);

        $order->load('customer');
        $order->customer?->notify(new OrderStatusChangedNotification($order, $order->status, $note));

        return $this->load($order->fresh());
    }

    /**
     * The customer confirms the parcel arrived. When the seller had only
     * marked it shipped, this also completes the shipped -> delivered step.
     *
     * @throws ValidationException
     */
    public function confirmReceipt(User $actor, Order $order): Order
    {
        $order = DB::transaction(function () use ($actor, $order) {
            /** @var Order $locked */
            $locked = Order::query()->lockForUpdate()->findOrFail($order->id);

            if ($locked->received_at !== null) {
                throw ValidationException::withMessages([
                    'order' => ['Receipt was already confirmed for this order.'],
                ]);
            }

            if (! in_array($locked->status, [OrderStatus::Shipped, OrderStatus::Delivered], true)) {
                throw ValidationException::withMessages([
                    'status' => ['Receipt can only be confirmed after the order has shipped.'],
                ]);
            }

            if ($locked->status === OrderStatus::Shipped) {
                $from = $locked->status;
                $locked->forceFill([
                    'status' => OrderStatus::Delivered,
                    'delivered_at' => now(),
                    'received_at' => now(),
                ])->save();
                $this->recordHistory($locked, $from, OrderStatus::Delivered, $actor, 'Receipt confirmed by the customer.');
                $this->syncGroupStatus($locked);
            } else {
                $locked->forceFill(['received_at' => now()])->save();
                $this->recordHistory($locked, $locked->status, $locked->status, $actor, 'Receipt confirmed by the customer.');
            }

            return $locked;
        });

        $this->activity->log('order.received', $actor, $order, [
            'reference' => $order->reference_number,
        ]);

        $order->load('store.owner');
        $order->store?->owner?->notify(new OrderStatusChangedNotification(
            $order,
            $order->status,
            'The customer confirmed receipt.',
        ));

        return $this->load($order->fresh());
    }

    /**
     * Record cash-on-delivery collection. Payment status is independent from
     * the order status and is never inferred from it.
     *
     * @throws ValidationException
     */
    public function collectPayment(User $actor, Order $order, ?string $notes = null): Order
    {
        $order = DB::transaction(function () use ($actor, $order, $notes) {
            /** @var Order $locked */
            $locked = Order::query()->lockForUpdate()->findOrFail($order->id);
            /** @var Payment|null $payment */
            $payment = Payment::query()->where('order_id', $locked->id)->lockForUpdate()->first();

            if (! $payment) {
                throw ValidationException::withMessages(['payment' => ['This order has no payment record.']]);
            }

            if ($locked->status !== OrderStatus::Delivered) {
                throw ValidationException::withMessages([
                    'status' => ['Cash can only be collected after the order is delivered.'],
                ]);
            }

            if ($payment->status === PaymentStatus::Collected) {
                throw ValidationException::withMessages([
                    'payment' => ['This payment was already collected.'],
                ]);
            }

            $payment->forceFill([
                'status' => PaymentStatus::Collected,
                'collected_at' => now(),
                'collected_by' => $actor->id,
                'notes' => $notes,
            ])->save();

            return $locked;
        });

        $this->activity->log('payment.collected', $actor, $order, [
            'reference' => $order->reference_number,
            'amount' => $order->total_amount,
        ]);

        $order->load('customer');
        $order->customer?->notify(new PaymentCollectedNotification($order));

        return $this->load($order->fresh());
    }

    /** @return list<string> */
    private function listRelations(): array
    {
        return [
            'store:id,name,slug,logo,user_id',
            'customer:id,name,email,phone',
            'items.product' => fn ($q) => $q->withTrashed(),
            'items.product.primaryImage:id,product_id,image_path,thumbnail_path',
            'items.variant:id,product_id,sku,attributes,stock_quantity',
            'items.review:id,order_item_id,rating,status',
            'address',
            'payment.collector:id,name',
        ];
    }

    private function recordHistory(Order $order, OrderStatus $from, OrderStatus $to, User $actor, ?string $note): void
    {
        $history = new OrderStatusHistory;
        $history->forceFill([
            'order_id' => $order->id,
            'from_status' => $from,
            'to_status' => $to,
            'changed_by' => $actor->id,
            'note' => $note,
        ])->save();
    }

    /** Keeps the checkout group in step with its per-store orders. */
    private function syncGroupStatus(Order $order): void
    {
        /** @var OrderGroup|null $group */
        $group = OrderGroup::query()->find($order->order_group_id);
        if (! $group) {
            return;
        }

        $statuses = Order::query()
            ->where('order_group_id', $group->id)
            ->get(['status'])
            ->map(fn (Order $row) => $row->status);

        $status = match (true) {
            $statuses->every(fn (OrderStatus $s) => $s === OrderStatus::Cancelled) => OrderGroupStatus::Cancelled,
            $statuses->contains(fn (OrderStatus $s) => in_array($s, [OrderStatus::Cancelled, OrderStatus::Returned], true)) => OrderGroupStatus::PartiallyCancelled,
            $statuses->every(fn (OrderStatus $s) => $s === OrderStatus::Delivered) => OrderGroupStatus::Completed,
            $statuses->contains(fn (OrderStatus $s) => $s !== OrderStatus::Pending) => OrderGroupStatus::Processing,
            default => OrderGroupStatus::Pending,
        };

        if ($group->status !== $status) {
            $group->forceFill(['status' => $status])->save();
        }
    }

    /**
     * Restore the stock deducted at checkout. The ledger's unique
     * (reference, type) pair makes this safe if a request is retried.
     */
    private function restoreStock(Order $order, InventoryMovementType $type, User $actor, string $note): void
    {
        $order->loadMissing('items.product', 'items.variant');

        foreach ($order->items as $item) {
            /** @var OrderItem $item */
            $already = $item->inventoryMovements()->where('type', $type->value)->exists();
            if ($already) {
                continue;
            }

            $product = $item->product;
            if (! $product) {
                continue;
            }

            $variant = $item->variant;
            if ($variant?->trashed()) {
                continue;
            }

            $this->inventory->adjust(
                $product,
                $variant,
                (int) $item->quantity,
                $type,
                $actor,
                $item,
                $note,
            );
        }
    }
}
