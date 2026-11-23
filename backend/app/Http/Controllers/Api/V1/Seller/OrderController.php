<?php

namespace App\Http\Controllers\Api\V1\Seller;

use App\Enums\OrderStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Order\CancelOrderRequest;
use App\Http\Requests\Order\CollectPaymentRequest;
use App\Http\Requests\Order\TransitionOrderRequest;
use App\Http\Resources\Order\OrderResource;
use App\Http\Responses\ApiResponse;
use App\Models\Order;
use App\Services\Order\OrderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/** Store-scoped fulfilment queue. Ownership is enforced by OrderPolicy. */
class OrderController extends Controller
{
    public function __construct(private readonly OrderService $orders) {}

    /** GET /seller/orders */
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'status' => ['nullable', Rule::enum(OrderStatus::class)],
            'q' => ['nullable', 'string', 'max:100'],
            'per_page' => ['nullable', 'integer', 'between:1,50'],
        ]);

        return ApiResponse::success(
            OrderResource::collection($this->orders->sellerOrders($request->user()->store, $filters)),
        );
    }

    /** GET /seller/orders/{order} */
    public function show(Order $order): JsonResponse
    {
        Gate::authorize('view', $order);

        return ApiResponse::success(new OrderResource($this->orders->load($order)));
    }

    /** PATCH /seller/orders/{order}/status */
    public function updateStatus(TransitionOrderRequest $request, Order $order): JsonResponse
    {
        Gate::authorize('updateStatus', $order);

        $order = $this->orders->transition(
            $request->user(),
            $order,
            OrderStatus::from($request->validated('status')),
            $request->validated('note'),
        );

        return ApiResponse::success(new OrderResource($order), 'Order status updated.');
    }

    /** POST /seller/orders/{order}/cancel */
    public function cancel(CancelOrderRequest $request, Order $order): JsonResponse
    {
        Gate::authorize('cancel', $order);

        $order = $this->orders->cancel($request->user(), $order, $request->validated('reason'), 'seller');

        return ApiResponse::success(new OrderResource($order), 'Order cancelled.');
    }

    /** POST /seller/orders/{order}/payment/collect */
    public function collectPayment(CollectPaymentRequest $request, Order $order): JsonResponse
    {
        Gate::authorize('collectPayment', $order);

        $order = $this->orders->collectPayment($request->user(), $order, $request->validated('notes'));

        return ApiResponse::success(new OrderResource($order), 'Cash collection recorded.');
    }
}
