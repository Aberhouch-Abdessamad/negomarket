<?php

namespace App\Http\Controllers\Api\V1\Cart;

use App\Http\Controllers\Controller;
use App\Http\Requests\Cart\AddCartItemRequest;
use App\Http\Requests\Cart\UpdateCartItemRequest;
use App\Http\Responses\ApiResponse;
use App\Models\CartItem;
use App\Services\Cart\CartService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The customer's cart. Prices, stock and ownership are resolved server-side
 * on every request, so the payload always reflects the current catalog.
 */
class CartController extends Controller
{
    public function __construct(private readonly CartService $cart) {}

    /** GET /cart */
    public function show(Request $request): JsonResponse
    {
        return ApiResponse::success($this->cart->summary($request->user()));
    }

    /** POST /cart/items */
    public function store(AddCartItemRequest $request): JsonResponse
    {
        $this->cart->add($request->user(), $request->validated());

        return ApiResponse::success(
            $this->cart->summary($request->user()),
            'Added to cart.',
            201,
        );
    }

    /** PUT /cart/items/{item} */
    public function update(UpdateCartItemRequest $request, CartItem $item): JsonResponse
    {
        $this->cart->updateQuantity($request->user(), $item, (int) $request->validated('quantity'));

        return ApiResponse::success($this->cart->summary($request->user()), 'Cart updated.');
    }

    /** DELETE /cart/items/{item} */
    public function destroy(Request $request, CartItem $item): JsonResponse
    {
        $this->cart->remove($request->user(), $item);

        return ApiResponse::success($this->cart->summary($request->user()), 'Item removed from cart.');
    }
}
