<?php

namespace App\Http\Controllers\Api\V1\Checkout;

use App\Http\Controllers\Controller;
use App\Http\Requests\Checkout\CheckoutPreviewRequest;
use App\Http\Requests\Checkout\PlaceOrderRequest;
use App\Http\Resources\Order\OrderGroupResource;
use App\Http\Responses\ApiResponse;
use App\Services\Order\CheckoutService;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\ValidationException;

/**
 * Checkout preview and order placement. Placing an order requires an
 * Idempotency-Key header so an accidental double submit cannot create
 * two order groups.
 */
class CheckoutController extends Controller
{
    public function __construct(private readonly CheckoutService $checkout) {}

    /** POST /checkout/preview */
    public function preview(CheckoutPreviewRequest $request): JsonResponse
    {
        return ApiResponse::success($this->checkout->preview($request->user(), $request->validated()));
    }

    /** POST /checkout */
    public function store(PlaceOrderRequest $request): JsonResponse
    {
        $key = trim((string) $request->header('Idempotency-Key'));

        if ($key === '' || mb_strlen($key) > 64) {
            throw ValidationException::withMessages([
                'idempotency_key' => ['An Idempotency-Key header (1-64 characters) is required.'],
            ]);
        }

        $result = $this->checkout->place($request->user(), $request->validated(), $key);

        return ApiResponse::success(
            new OrderGroupResource($result['group']),
            $result['replayed'] ? 'This order was already placed.' : 'Order placed successfully.',
            $result['replayed'] ? 200 : 201,
        );
    }
}
