<?php

namespace App\Services\Admin;

use App\Enums\DisputeStatus;
use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Enums\ProductStatus;
use App\Enums\ReviewStatus;
use App\Enums\StoreApplicationStatus;
use App\Enums\StoreStatus;
use App\Models\Dispute;
use App\Models\Negotiation;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Models\Product;
use App\Models\ProductReview;
use App\Models\Store;
use App\Models\StoreApplication;
use App\Models\User;
use Illuminate\Support\Carbon;

/** Aggregates the numbers rendered on the admin landing page. */
class DashboardService
{
    /** Statuses that count towards revenue (anything not cancelled or returned). */
    public const REVENUE_STATUSES = [
        OrderStatus::Pending,
        OrderStatus::Confirmed,
        OrderStatus::Processing,
        OrderStatus::Shipped,
        OrderStatus::Delivered,
    ];

    /** @return array<string, mixed> */
    public function overview(): array
    {
        $since = now()->subDays(30)->startOfDay();

        return [
            'users' => [
                'total' => User::query()->count(),
                'active' => User::query()->where('status', 'active')->count(),
                'new_30d' => User::query()->where('created_at', '>=', $since)->count(),
                'sellers' => User::query()->role('seller')->count(),
                'admins' => User::query()->role('admin')->count(),
            ],
            'stores' => [
                'total' => Store::query()->count(),
                'active' => Store::query()->where('status', StoreStatus::Active)->count(),
            ],
            'applications' => [
                'pending' => StoreApplication::query()->where('status', StoreApplicationStatus::Pending)->count(),
            ],
            'products' => [
                'total' => Product::query()->count(),
                'pending_review' => Product::query()->where('status', ProductStatus::PendingReview)->count(),
            ],
            'orders' => [
                'total' => Order::query()->count(),
                'pending' => Order::query()->where('status', OrderStatus::Pending)->count(),
                'last_30d' => Order::query()->where('created_at', '>=', $since)->count(),
                'revenue_total' => (float) Order::query()->whereIn('status', self::REVENUE_STATUSES)->sum('total_amount'),
                'revenue_30d' => (float) Order::query()->whereIn('status', self::REVENUE_STATUSES)->where('created_at', '>=', $since)->sum('total_amount'),
            ],
            'payments' => [
                'collected_total' => (float) Payment::query()->where('status', PaymentStatus::Collected)->sum('amount'),
                'uncollected_total' => (float) Payment::query()->where('status', PaymentStatus::Unpaid)->sum('amount'),
            ],
            'negotiations' => [
                'active' => Negotiation::query()->where('status', 'active')->count(),
            ],
            'disputes' => [
                'open' => Dispute::query()->whereIn('status', [DisputeStatus::Open, DisputeStatus::UnderReview])->count(),
                'resolved_30d' => Dispute::query()->whereIn('status', [DisputeStatus::Resolved, DisputeStatus::Rejected, DisputeStatus::Closed])->where('updated_at', '>=', $since)->count(),
            ],
            'reviews' => [
                'pending' => ProductReview::query()->where('status', ReviewStatus::Pending)->count(),
                'approved' => ProductReview::query()->where('status', ReviewStatus::Approved)->count(),
            ],
            'recent_orders' => Order::query()
                ->with(['store:id,name,slug', 'customer:id,name,email'])
                ->latest('id')
                ->limit(8)
                ->get()
                ->map(fn (Order $order) => [
                    'id' => $order->id,
                    'reference_number' => $order->reference_number,
                    'status' => $order->status->value,
                    'status_label' => $order->status->label(),
                    'total_amount' => (float) $order->total_amount,
                    'store' => $order->store ? ['id' => $order->store->id, 'name' => $order->store->name] : null,
                    'customer' => $order->customer ? ['id' => $order->customer->id, 'name' => $order->customer->name] : null,
                    'created_at' => $order->created_at?->toIso8601String(),
                ]),
            'sales_series' => $this->dailySeries(14),
        ];
    }

    /** @return list<array{date: string, orders: int, revenue: float}> */
    public function dailySeries(int $days): array
    {
        $from = now()->subDays($days - 1)->startOfDay();

        $rows = Order::query()
            ->where('created_at', '>=', $from)
            ->selectRaw('DATE(created_at) as day, COUNT(*) as orders_count, COALESCE(SUM(total_amount), 0) as revenue')
            ->whereIn('status', self::REVENUE_STATUSES)
            ->groupBy('day')
            ->orderBy('day')
            ->get()
            ->keyBy(fn ($row) => (string) $row->day);

        return collect(range(0, $days - 1))
            ->map(function (int $offset) use ($from, $rows) {
                $date = $from->copy()->addDays($offset);
                $row = $rows->get($date->toDateString());

                return [
                    'date' => $date->toDateString(),
                    'orders' => (int) ($row->orders_count ?? 0),
                    'revenue' => (float) ($row->revenue ?? 0),
                ];
            })
            ->all();
    }

    /** @return array<string, mixed> */
    public function salesReport(int $days): array
    {
        $from = now()->subDays($days - 1)->startOfDay();
        $orders = Order::query()->where('created_at', '>=', $from)->whereIn('status', self::REVENUE_STATUSES);

        $statusBreakdown = Order::query()
            ->where('created_at', '>=', $from)
            ->selectRaw('status, COUNT(*) as total')
            ->groupBy('status')
            ->get()
            ->mapWithKeys(fn ($row) => [
                $row->status instanceof OrderStatus ? $row->status->value : (string) $row->status => (int) $row->total,
            ]);

        $topStores = Order::query()
            ->where('orders.created_at', '>=', $from)
            ->whereIn('orders.status', self::REVENUE_STATUSES)
            ->join('stores', 'stores.id', '=', 'orders.store_id')
            ->selectRaw('stores.id, stores.name, COUNT(*) as orders_count, COALESCE(SUM(orders.total_amount), 0) as revenue')
            ->groupBy('stores.id', 'stores.name')
            ->orderByDesc('revenue')
            ->limit(8)
            ->get()
            ->map(fn ($row) => [
                'id' => (int) $row->id,
                'name' => $row->name,
                'orders_count' => (int) $row->orders_count,
                'revenue' => (float) $row->revenue,
            ]);

        $topProducts = OrderItem::query()
            ->whereHas('order', fn ($q) => $q->where('created_at', '>=', $from)->whereIn('status', self::REVENUE_STATUSES))
            ->selectRaw('product_id, MAX(product_name) as product_name, SUM(quantity) as quantity, COALESCE(SUM(total_price), 0) as revenue')
            ->groupBy('product_id')
            ->orderByDesc('revenue')
            ->limit(8)
            ->get()
            ->map(fn ($row) => [
                'id' => (int) $row->product_id,
                'name' => $row->product_name,
                'quantity' => (int) $row->quantity,
                'revenue' => (float) $row->revenue,
            ]);

        return [
            'range' => ['days' => $days, 'from' => $from->toDateString(), 'to' => Carbon::today()->toDateString()],
            'totals' => [
                'orders' => (clone $orders)->count(),
                'revenue' => (float) (clone $orders)->sum('total_amount'),
                'average_order_value' => round((float) (clone $orders)->avg('total_amount'), 2),
                'collected' => (float) Payment::query()->where('status', PaymentStatus::Collected)->where('collected_at', '>=', $from)->sum('amount'),
                'uncollected' => (float) Payment::query()->where('status', PaymentStatus::Unpaid)->where('created_at', '>=', $from)->sum('amount'),
            ],
            'status_breakdown' => $statusBreakdown,
            'top_stores' => $topStores,
            'top_products' => $topProducts,
            'sales_series' => $this->dailySeries($days),
        ];
    }
}
