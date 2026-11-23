<?php

namespace App\Services\Store;

use App\Enums\NegotiationStatus;
use App\Enums\OfferSenderRole;
use App\Enums\OfferStatus;
use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Enums\ProductStatus;
use App\Models\Negotiation;
use App\Models\NegotiationOffer;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\Store;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * Real, store-scoped statistics computed from the database (no fake numbers).
 * Revenue counts orders that were not cancelled/returned; "collected" counts
 * COD payments actually marked as collected.
 */
class SellerAnalyticsService
{
    public const LOW_STOCK_THRESHOLD = 5;

    /** @return array<string, mixed> */
    public function dashboard(Store $store): array
    {
        $since = CarbonImmutable::now()->subDays(30)->startOfDay();
        $orders = Order::query()->where('store_id', $store->id);
        $valid = fn ($q) => $q->whereNotIn('status', [OrderStatus::Cancelled, OrderStatus::Returned]);

        $byStatus = (clone $orders)->selectRaw('status, COUNT(*) as total')->groupBy('status')->pluck('total', 'status');
        $products = Product::query()->where('store_id', $store->id);

        return [
            'kpis' => [
                'revenue_30d' => (float) $valid((clone $orders)->where('created_at', '>=', $since))->sum('total_amount'),
                'orders_30d' => $valid((clone $orders)->where('created_at', '>=', $since))->count(),
                'pending_orders' => (int) ($byStatus[OrderStatus::Pending->value] ?? 0),
                'cod_to_collect' => (float) Order::query()->where('store_id', $store->id)
                    ->where('status', OrderStatus::Delivered)
                    ->whereHas('payment', fn ($q) => $q->where('status', PaymentStatus::Unpaid))
                    ->sum('total_amount'),
                'cod_collected_30d' => (float) DB::table('payments')->join('orders', 'orders.id', '=', 'payments.order_id')
                    ->where('orders.store_id', $store->id)->where('payments.status', PaymentStatus::Collected->value)
                    ->where('payments.collected_at', '>=', $since)->sum('payments.amount'),
                'active_negotiations' => Negotiation::query()->where('store_id', $store->id)->where('status', NegotiationStatus::Active)->count(),
                'offers_awaiting_reply' => NegotiationOffer::query()
                    ->where('status', OfferStatus::Pending)->where('sender_role', OfferSenderRole::Customer)
                    ->whereHas('negotiation', fn ($q) => $q->where('store_id', $store->id))->count(),
                'product_views' => (int) (clone $products)->sum('views_count'),
                'rating_avg' => (float) $store->rating_avg,
                'rating_count' => (int) $store->rating_count,
            ],
            'products' => [
                'by_status' => collect(ProductStatus::cases())->mapWithKeys(fn ($s) => [$s->value => 0])
                    ->merge((clone $products)->selectRaw('status, COUNT(*) as total')->groupBy('status')->pluck('total', 'status'))
                    ->map(fn ($v) => (int) $v),
                'low_stock' => (clone $products)->whereBetween('stock_quantity', [1, self::LOW_STOCK_THRESHOLD])->count(),
                'out_of_stock' => (clone $products)->where('stock_quantity', 0)->whereNot('status', ProductStatus::Archived)->count(),
            ],
            'orders_by_status' => collect(OrderStatus::cases())->mapWithKeys(fn ($s) => [$s->value => (int) ($byStatus[$s->value] ?? 0)]),
            'low_stock_products' => (clone $products)->where('stock_quantity', '<=', self::LOW_STOCK_THRESHOLD)
                ->whereNot('status', ProductStatus::Archived)->orderBy('stock_quantity')->limit(6)
                ->get(['id', 'name', 'sku', 'stock_quantity', 'status']),
            'recent_orders' => (clone $orders)->with('customer:id,name')->latest('id')->limit(5)
                ->get(['id', 'reference_number', 'customer_id', 'total_amount', 'status', 'created_at'])
                ->map(fn (Order $o) => [
                    'id' => $o->id, 'reference_number' => $o->reference_number, 'customer' => $o->customer?->name,
                    'total_amount' => (float) $o->total_amount, 'status' => $o->status->value, 'created_at' => $o->created_at->toIso8601String(),
                ]),
            'sales_last_30_days' => $this->dailySeries($store, 30),
        ];
    }

    /** @return array<string, mixed> */
    public function analytics(Store $store, int $days): array
    {
        $since = CarbonImmutable::now()->subDays($days - 1)->startOfDay();

        $top = OrderItem::query()
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->where('orders.store_id', $store->id)
            ->whereNotIn('orders.status', [OrderStatus::Cancelled->value, OrderStatus::Returned->value])
            ->where('orders.created_at', '>=', $since)
            ->groupBy('order_items.product_id', 'order_items.product_name')
            ->selectRaw('order_items.product_id, order_items.product_name, SUM(order_items.quantity) as units, SUM(order_items.total_price) as revenue, SUM(CASE WHEN order_items.negotiation_id IS NOT NULL THEN 1 ELSE 0 END) as negotiated_lines')
            ->orderByDesc('revenue')->limit(10)->get()
            ->map(fn ($r) => ['product_id' => $r->product_id, 'name' => $r->product_name, 'units' => (int) $r->units, 'revenue' => (float) $r->revenue, 'negotiated_lines' => (int) $r->negotiated_lines]);

        $negotiations = Negotiation::query()->where('store_id', $store->id)->where('created_at', '>=', $since)
            ->selectRaw('status, COUNT(*) as total')->groupBy('status')->pluck('total', 'status');
        $totalNeg = (int) $negotiations->sum();
        $won = (int) (($negotiations[NegotiationStatus::Accepted->value] ?? 0) + ($negotiations[NegotiationStatus::ConvertedToOrder->value] ?? 0));

        $discount = OrderItem::query()->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->where('orders.store_id', $store->id)->whereNotNull('order_items.negotiation_id')
            ->where('orders.created_at', '>=', $since)
            ->selectRaw('SUM(order_items.original_price * order_items.quantity) as listed, SUM(order_items.total_price) as paid')->first();

        $series = $this->dailySeries($store, $days);

        return [
            'period_days' => $days,
            'totals' => [
                'revenue' => round(array_sum(array_column($series, 'revenue')), 2),
                'orders' => array_sum(array_column($series, 'orders')),
                'average_order_value' => ($o = array_sum(array_column($series, 'orders'))) ? round(array_sum(array_column($series, 'revenue')) / $o, 2) : 0,
            ],
            'series' => $series,
            'top_products' => $top,
            'negotiations' => [
                'total' => $totalNeg,
                'accepted' => $won,
                'conversion_rate' => $totalNeg ? round($won / $totalNeg * 100, 1) : 0,
                'by_status' => collect(NegotiationStatus::cases())->mapWithKeys(fn ($s) => [$s->value => (int) ($negotiations[$s->value] ?? 0)]),
                'average_discount_percent' => ($discount && (float) $discount->listed > 0) ? round((1 - (float) $discount->paid / (float) $discount->listed) * 100, 1) : 0,
            ],
        ];
    }

    /** @return list<array{date: string, orders: int, revenue: float}> one entry per day, zero-filled */
    private function dailySeries(Store $store, int $days): array
    {
        $since = CarbonImmutable::now()->subDays($days - 1)->startOfDay();
        $rows = Order::query()->where('store_id', $store->id)->where('created_at', '>=', $since)
            ->whereNotIn('status', [OrderStatus::Cancelled, OrderStatus::Returned])
            ->selectRaw('DATE(created_at) as day, COUNT(*) as orders, SUM(total_amount) as revenue')
            ->groupBy('day')->get()->keyBy('day');

        $series = [];
        for ($d = $since; $d->lte(CarbonImmutable::now()); $d = $d->addDay()) {
            $key = $d->toDateString();
            $series[] = ['date' => $key, 'orders' => (int) ($rows[$key]->orders ?? 0), 'revenue' => (float) ($rows[$key]->revenue ?? 0)];
        }

        return $series;
    }
}
