<?php

namespace Tests\Concerns;

use App\Enums\OrderStatus;
use App\Models\Order;
use App\Models\OrderGroup;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Models\Product;
use App\Models\Store;
use App\Models\User;

/** Creates a realistic single-store order row set without going through checkout. */
trait BuildsOrders
{
    protected function makeOrder(
        User $customer,
        Store $store,
        Product $product,
        OrderStatus $status = OrderStatus::Pending,
        int $quantity = 2,
        float $unitPrice = 1000,
        ?OrderGroup $group = null,
    ): Order {
        $subtotal = round($unitPrice * $quantity, 2);

        $group ??= OrderGroup::factory()->for($customer, 'customer')->create([
            'subtotal' => $subtotal,
            'shipping_total' => 0,
            'discount_total' => 0,
            'total_amount' => $subtotal,
        ]);

        $order = Order::factory()->create([
            'order_group_id' => $group->id,
            'store_id' => $store->id,
            'customer_id' => $customer->id,
            'subtotal' => $subtotal,
            'shipping_cost' => 0,
            'discount' => 0,
            'total_amount' => $subtotal,
            'status' => $status,
            ...$this->statusTimestamps($status),
        ]);

        OrderItem::factory()->create([
            'order_id' => $order->id,
            'product_id' => $product->id,
            'quantity' => $quantity,
            'original_price' => $unitPrice,
            'unit_price' => $unitPrice,
            'total_price' => $subtotal,
        ]);

        Payment::factory()->create([
            'order_id' => $order->id,
            'amount' => $subtotal,
        ]);

        return $order->fresh();
    }

    /** @return array<string, mixed> */
    private function statusTimestamps(OrderStatus $status): array
    {
        return match ($status) {
            OrderStatus::Confirmed, OrderStatus::Processing => ['confirmed_at' => now()->subDays(2)],
            OrderStatus::Shipped => ['confirmed_at' => now()->subDays(3), 'shipped_at' => now()->subDay()],
            OrderStatus::Delivered => ['confirmed_at' => now()->subDays(4), 'shipped_at' => now()->subDays(2), 'delivered_at' => now()->subDay()],
            OrderStatus::Returned => ['confirmed_at' => now()->subDays(5), 'shipped_at' => now()->subDays(3), 'delivered_at' => now()->subDays(2)],
            default => [],
        };
    }
}
