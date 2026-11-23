<?php

namespace App\Http\Controllers\Api\V1\Customer;

use App\Enums\OrderStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Order\CancelOrderRequest;
use App\Http\Resources\Order\OrderGroupResource;
use App\Http\Resources\Order\OrderResource;
use App\Http\Responses\ApiResponse;
use App\Models\Order;
use App\Models\OrderGroup;
use App\Services\Order\OrderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/** Customer order history and post-purchase actions. */
class OrderController extends Controller
{
    public function __construct(private readonly OrderService $orders) {}

    /** GET /orders */
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'status' => ['nullable', Rule::enum(OrderStatus::class)],
            'store_id' => ['nullable', 'integer'],
            'per_page' => ['nullable', 'integer', 'between:1,50'],
        ]);

        return ApiResponse::success(
            OrderResource::collection($this->orders->customerOrders($request->user(), $filters)),
        );
    }

    /** GET /orders/{order} */
    public function show(Request $request, Order $order): JsonResponse
    {
        Gate::authorize('view', $order);

        return ApiResponse::success(new OrderResource($this->orders->load($order)));
    }

    /** GET /order-groups/{orderGroup} */
    public function showGroup(Request $request, OrderGroup $orderGroup): JsonResponse
    {
        $user = $request->user();
        abort_unless(
            (int) $orderGroup->customer_id === (int) $user->id || $user->hasPermissionTo('orders.manage'),
            403,
            'This action is unauthorized.',
        );

        return ApiResponse::success(new OrderGroupResource($this->orders->loadGroup($orderGroup)));
    }

    /** POST /orders/{order}/cancel */
    public function cancel(CancelOrderRequest $request, Order $order): JsonResponse
    {
        Gate::authorize('cancel', $order);

        $order = $this->orders->cancel($request->user(), $order, $request->validated('reason'), 'customer');

        return ApiResponse::success(new OrderResource($order), 'Order cancelled.');
    }

    /** POST /orders/{order}/receipt */
    public function confirmReceipt(Request $request, Order $order): JsonResponse
    {
        Gate::authorize('confirmReceipt', $order);

        $order = $this->orders->confirmReceipt($request->user(), $order);

        return ApiResponse::success(new OrderResource($order), 'Receipt confirmed. Thank you!');
    }
}
