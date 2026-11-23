<?php

namespace App\Policies;

use App\Enums\OrderStatus;
use App\Models\Order;
use App\Models\User;

/**
 * Record-level rules for orders.
 *
 * Customers may see and act on their own orders; sellers only on orders of
 * their own store. Administrators with `orders.manage` can see everything.
 * Every method uses queries for ownership so policies never trigger a lazy
 * load under Model::shouldBeStrict().
 */
class OrderPolicy
{
    public function view(User $user, Order $order): bool
    {
        return $this->isCustomer($user, $order)
            || $this->ownsStore($user, $order)
            || $user->hasPermissionTo('orders.manage');
    }

    /** Seller fulfilment (and admin overrides). Transitions are still enforced by OrderService. */
    public function updateStatus(User $user, Order $order): bool
    {
        return ($this->ownsStore($user, $order) && $user->hasPermissionTo('orders.fulfil'))
            || $user->hasPermissionTo('orders.manage');
    }

    public function cancel(User $user, Order $order): bool
    {
        if ($user->hasPermissionTo('orders.manage')) {
            return true;
        }

        if ($this->isCustomer($user, $order)) {
            return $order->status->isCancellableByCustomer();
        }

        return $this->ownsStore($user, $order)
            && in_array($order->status, [OrderStatus::Pending, OrderStatus::Confirmed, OrderStatus::Processing], true);
    }

    /** A customer confirms receipt once the seller shipped/delivered the parcel. */
    public function confirmReceipt(User $user, Order $order): bool
    {
        return $this->isCustomer($user, $order)
            && $order->received_at === null
            && in_array($order->status, [OrderStatus::Shipped, OrderStatus::Delivered], true);
    }

    /** COD is recorded by the seller (or a payment manager) after delivery. */
    public function collectPayment(User $user, Order $order): bool
    {
        return ($this->ownsStore($user, $order) && $user->hasPermissionTo('payments.collect'))
            || $user->hasPermissionTo('payments.manage');
    }

    public function openDispute(User $user, Order $order): bool
    {
        return $this->isCustomer($user, $order)
            && $user->hasPermissionTo('disputes.create')
            && in_array($order->status, [OrderStatus::Shipped, OrderStatus::Delivered, OrderStatus::Returned], true);
    }

    public function review(User $user, Order $order): bool
    {
        return $this->isCustomer($user, $order)
            && $user->hasPermissionTo('reviews.create')
            && in_array($order->status, [OrderStatus::Delivered, OrderStatus::Returned], true);
    }

    private function isCustomer(User $user, Order $order): bool
    {
        return (int) $order->customer_id === (int) $user->id;
    }

    private function ownsStore(User $user, Order $order): bool
    {
        return $order->store()->where('user_id', $user->id)->exists();
    }
}
