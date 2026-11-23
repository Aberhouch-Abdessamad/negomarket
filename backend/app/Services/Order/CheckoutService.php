<?php

namespace App\Services\Order;

use App\Enums\OrderGroupStatus;
use App\Enums\OrderStatus;
use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Enums\InventoryMovementType;
use App\Enums\NegotiationStatus;
use App\Models\CartItem;
use App\Models\Negotiation;
use App\Models\Order;
use App\Models\OrderAddress;
use App\Models\OrderGroup;
use App\Models\OrderItem;
use App\Models\OrderStatusHistory;
use App\Models\Payment;
use App\Models\Setting;
use App\Models\User;
use App\Models\UserAddress;
use App\Notifications\Order\OrderPlacedNotification;
use App\Services\Audit\ActivityLogger;
use App\Services\Cart\CartService;
use App\Services\Inventory\InventoryService;
use Illuminate\Database\QueryException;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Multi-vendor checkout and accepted-offer conversion.
 *
 * One order_group per checkout and one order per store. Prices, discounts and
 * totals are always recomputed from the database; the client only supplies
 * quantities, the delivery address and (optionally) accepted negotiations.
 */
class CheckoutService
{
    public function __construct(
        private readonly CartService $cart,
        private readonly InventoryService $inventory,
        private readonly ActivityLogger $activity,
    ) {}

    /**
     * Price a checkout without writing anything.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public function preview(User $user, array $data): array
    {
        $address = $this->resolveAddress($user, $data);
        $built = $this->build($user, $data['negotiation_ids'] ?? []);

        return $this->present($built, $address);
    }

    /**
     * Place the order. Idempotent per (customer, Idempotency-Key).
     *
     * @param  array<string, mixed>  $data
     * @return array{group: OrderGroup, replayed: bool}
     */
    public function place(User $user, array $data, string $idempotencyKey): array
    {
        $existing = OrderGroup::query()
            ->where('customer_id', $user->id)
            ->where('idempotency_key', $idempotencyKey)
            ->first();

        if ($existing) {
            return ['group' => $this->loadGroup($existing), 'replayed' => true];
        }

        $address = $this->resolveAddress($user, $data, required: true);

        try {
            $result = DB::transaction(function () use ($user, $data, $idempotencyKey, $address) {
                $built = $this->build($user, $data['negotiation_ids'] ?? []);

                $groups = collect($built['lines'])->groupBy(fn (array $line) => $line['store']->id);
                $shippingPerStore = (float) Setting::get('checkout.default_shipping_cost', 0);

                $subtotal = round(collect($built['lines'])->sum(fn (array $line) => $line['unit_price'] * $line['quantity']), 2);
                $shippingTotal = round($shippingPerStore * $groups->count(), 2);

                $group = new OrderGroup;
                $group->forceFill([
                    'customer_id' => $user->id,
                    'reference_number' => $this->reference('NM'),
                    'idempotency_key' => $idempotencyKey,
                    'payment_method' => PaymentMethod::Cod,
                    'subtotal' => $subtotal,
                    'shipping_total' => $shippingTotal,
                    'discount_total' => 0,
                    'total_amount' => round($subtotal + $shippingTotal, 2),
                    'status' => OrderGroupStatus::Pending,
                ])->save();

                $orders = new Collection;

                foreach ($groups as $storeId => $storeLines) {
                    $orderSubtotal = round($storeLines->sum(fn (array $line) => $line['unit_price'] * $line['quantity']), 2);
                    $orderTotal = round($orderSubtotal + $shippingPerStore, 2);

                    $order = new Order;
                    $order->forceFill([
                        'order_group_id' => $group->id,
                        'store_id' => (int) $storeId,
                        'customer_id' => $user->id,
                        'reference_number' => $this->reference('ORD'),
                        'subtotal' => $orderSubtotal,
                        'shipping_cost' => $shippingPerStore,
                        'discount' => 0,
                        'total_amount' => $orderTotal,
                        'status' => OrderStatus::Pending,
                        'customer_notes' => $data['customer_notes'] ?? null,
                    ])->save();

                    foreach ($storeLines as $line) {
                        $item = new OrderItem;
                        $item->forceFill([
                            'order_id' => $order->id,
                            'product_id' => $line['product']->id,
                            'product_variant_id' => $line['variant']?->id,
                            'negotiation_id' => $line['negotiation_id'],
                            'product_name' => $line['product']->name,
                            'sku' => $line['variant']?->sku ?? $line['product']->sku,
                            'variant_attributes' => $line['variant']?->getAttribute('attributes'),
                            'quantity' => $line['quantity'],
                            'original_price' => $line['original_price'],
                            'unit_price' => $line['unit_price'],
                            'total_price' => round($line['unit_price'] * $line['quantity'], 2),
                        ])->save();

                        $this->inventory->adjust(
                            $line['product'],
                            $line['variant'],
                            -1 * $line['quantity'],
                            InventoryMovementType::Sale,
                            $user,
                            $item,
                            'Order '.$order->reference_number,
                        );

                        if ($line['negotiation_id']) {
                            Negotiation::query()->whereKey($line['negotiation_id'])->update([
                                'status' => NegotiationStatus::ConvertedToOrder,
                                'converted_order_id' => $order->id,
                                'closed_at' => now(),
                                'last_activity_at' => now(),
                            ]);
                        }
                    }

                    $addressModel = new OrderAddress;
                    $addressModel->forceFill(array_merge($address, ['order_id' => $order->id]))->save();

                    $payment = new Payment;
                    $payment->forceFill([
                        'order_id' => $order->id,
                        'payment_method' => PaymentMethod::Cod,
                        'amount' => $orderTotal,
                        'status' => PaymentStatus::Unpaid,
                    ])->save();

                    $history = new OrderStatusHistory;
                    $history->forceFill([
                        'order_id' => $order->id,
                        'from_status' => null,
                        'to_status' => OrderStatus::Pending,
                        'changed_by' => $user->id,
                        'note' => 'Order placed by the customer.',
                    ])->save();

                    $orders->push($order);
                }

                if ($built['cart_item_ids'] !== []) {
                    CartItem::query()->whereIn('id', $built['cart_item_ids'])->delete();
                }

                $this->activity->log('order.placed', $user, $group, [
                    'reference' => $group->reference_number,
                    'orders' => $orders->pluck('reference_number')->all(),
                    'total' => $group->total_amount,
                ]);

                return ['group' => $group, 'orders' => $orders, 'replayed' => false];
            });
        } catch (QueryException $e) {
            // A concurrent retry with the same key won the unique constraint.
            $existing = OrderGroup::query()
                ->where('customer_id', $user->id)
                ->where('idempotency_key', $idempotencyKey)
                ->first();

            if ($existing) {
                return ['group' => $this->loadGroup($existing), 'replayed' => true];
            }

            throw $e;
        }

        $group = $this->loadGroup($result['group']);

        foreach ($group->orders as $order) {
            $owner = $order->store?->owner;
            $owner?->notify(new OrderPlacedNotification($order));
        }

        return ['group' => $group, 'replayed' => false];
    }

    /**
     * Resolve and validate every purchasable line.
     *
     * @param  list<int>  $negotiationIds
     * @return array{lines: list<array<string, mixed>>, cart_item_ids: list<int>}
     */
    private function build(User $user, array $negotiationIds): array
    {
        $built = $this->cart->checkoutLines($user, $negotiationIds);

        if ($built['lines'] === []) {
            throw ValidationException::withMessages(['cart' => ['Your cart is empty.']]);
        }

        return $built;
    }

    /**
     * @param  array{lines: list<array<string, mixed>>, cart_item_ids: list<int>}  $built
     * @param  array<string, mixed>|null  $address
     * @return array<string, mixed>
     */
    private function present(array $built, ?array $address): array
    {
        $currency = (string) Setting::get('checkout.currency', 'MAD');
        $shippingPerStore = (float) Setting::get('checkout.default_shipping_cost', 0);

        $lines = collect($built['lines'])->map(fn (array $line) => [
            'key' => $line['negotiation_id'] ? 'negotiation:'.$line['negotiation_id'] : 'cart:'.$line['cart_item_id'],
            'cart_item_id' => $line['cart_item_id'],
            'negotiation_id' => $line['negotiation_id'],
            'quantity' => $line['quantity'],
            'unit_price' => round((float) $line['unit_price'], 2),
            'original_price' => round((float) $line['original_price'], 2),
            'line_total' => round((float) $line['unit_price'] * $line['quantity'], 2),
            'is_negotiated' => $line['negotiation_id'] !== null,
            'product' => [
                'id' => $line['product']->id,
                'name' => $line['product']->name,
                'slug' => $line['product']->slug,
                'thumbnail_url' => $line['product']->primaryImage?->thumbnailUrl(),
            ],
            'variant' => $line['variant'] ? [
                'id' => $line['variant']->id,
                'sku' => $line['variant']->sku,
                'attributes' => $line['variant']->getAttribute('attributes'),
            ] : null,
            'store' => $this->storePayload($line['store']),
        ])->values();

        $groups = $lines->groupBy(fn (array $line) => $line['store']['id'])
            ->map(function (Collection $storeLines) use ($shippingPerStore) {
                $subtotal = round($storeLines->sum('line_total'), 2);

                return [
                    'store' => $storeLines->first()['store'],
                    'items' => $storeLines->values()->all(),
                    'subtotal' => $subtotal,
                    'shipping_cost' => $shippingPerStore,
                    'total' => round($subtotal + $shippingPerStore, 2),
                ];
            })->values();

        $subtotal = round($lines->sum('line_total'), 2);

        return [
            'lines' => $lines->all(),
            'groups' => $groups->all(),
            'summary' => [
                'item_count' => $lines->count(),
                'total_quantity' => (int) $lines->sum('quantity'),
                'subtotal' => $subtotal,
                'shipping_total' => round($shippingPerStore * $groups->count(), 2),
                'total' => round($subtotal + $shippingPerStore * $groups->count(), 2),
                'currency' => $currency,
                'payment_method' => 'cod',
            ],
            'address' => $address,
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>|null
     */
    private function resolveAddress(User $user, array $data, bool $required = false): ?array
    {
        if (! empty($data['address_id'])) {
            /** @var UserAddress|null $saved */
            $saved = $user->addresses()->whereKey($data['address_id'])->first();
            if (! $saved) {
                throw ValidationException::withMessages(['address_id' => ['This address does not belong to you.']]);
            }

            return $this->addressPayload($saved);
        }

        if (! empty($data['address'])) {
            return $this->addressPayload($data['address']);
        }

        if ($required) {
            throw ValidationException::withMessages(['address' => ['A delivery address is required.']]);
        }

        return null;
    }

    /**
     * @param  UserAddress|array<string, mixed>  $source
     * @return array<string, mixed>
     */
    private function addressPayload(UserAddress|array $source): array
    {
        $isArray = is_array($source);
        $get = function (string $key, mixed $default = null) use ($source, $isArray) {
            if ($isArray) {
                return $source[$key] ?? $default;
            }

            // getAttributes() avoids Model::shouldBeStrict() throwing on
            // columns that the address table simply does not have.
            return $source->getAttributes()[$key] ?? $default;
        };

        return [
            'full_name' => (string) $get('full_name'),
            'phone' => (string) $get('phone'),
            'address_line1' => (string) $get('address_line1'),
            'address_line2' => $get('address_line2'),
            'city' => (string) $get('city'),
            'region' => $get('region'),
            'postal_code' => $get('postal_code'),
            'country' => strtoupper((string) $get('country', 'MA')),
            'delivery_notes' => $get('delivery_notes'),
        ];
    }

    private function loadGroup(OrderGroup $group): OrderGroup
    {
        return $group->load([
            'orders.store.owner',
            'orders.items.product.primaryImage',
            'orders.items.variant',
            'orders.address',
            'orders.payment',
            'orders.statusHistory',
        ]);
    }

    private function reference(string $prefix): string
    {
        return $prefix.'-'.strtoupper((string) Str::ulid());
    }

    /** @return array<string, mixed> */
    private function storePayload(object $store): array
    {
        return [
            'id' => $store->id,
            'name' => $store->name,
            'slug' => $store->slug,
            'logo_url' => method_exists($store, 'logoUrl') ? $store->logoUrl() : null,
        ];
    }
}
