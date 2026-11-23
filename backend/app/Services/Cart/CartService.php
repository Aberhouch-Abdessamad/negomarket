<?php

namespace App\Services\Cart;

use App\Enums\NegotiationStatus;
use App\Enums\ProductStatus;
use App\Enums\StoreStatus;
use App\Enums\VariantStatus;
use App\Models\Cart;
use App\Models\CartItem;
use App\Models\Negotiation;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Shopping cart. Cart rows never store prices or ownership: every read
 * resolves the product, the variant and (for negotiated lines) the accepted
 * offer on the server, so a tampered client cannot change what is charged.
 */
class CartService
{
    public function cartFor(User $user): Cart
    {
        return Cart::query()->firstOrCreate(['user_id' => $user->id]);
    }

    /**
     * Add a product (or an accepted negotiation) to the cart.
     *
     * @param  array<string, mixed>  $data
     */
    public function add(User $user, array $data): CartItem
    {
        return DB::transaction(function () use ($user, $data) {
            $cart = $this->cartFor($user);
            $quantity = (int) ($data['quantity'] ?? 1);

            $negotiation = null;
            if (! empty($data['negotiation_id'])) {
                $negotiation = $this->acceptedNegotiation($user, (int) $data['negotiation_id']);
                $product = $negotiation->product;
                $variant = $negotiation->variant;
                $quantity = $negotiation->quantity;
            } else {
                /** @var Product $product */
                $product = Product::query()->with(['store', 'primaryImage'])->findOrFail($data['product_id']);
                $variant = ! empty($data['product_variant_id'])
                    ? ProductVariant::query()->where('product_id', $product->id)->findOrFail($data['product_variant_id'])
                    : null;
            }

            $this->assertPurchasable($user, $product, $variant, $quantity);

            $existing = CartItem::query()
                ->where('cart_id', $cart->id)
                ->where('product_id', $product->id)
                ->where('product_variant_id', $variant?->id)
                ->lockForUpdate()
                ->first();

            if ($existing) {
                if ($existing->negotiation_id) {
                    // Only one line per product/variant exists, so a second
                    // negotiation for the same item would silently reuse the
                    // first agreed price. Reject it instead.
                    if ($negotiation && $existing->negotiation_id !== $negotiation->id) {
                        throw ValidationException::withMessages([
                            'negotiation_id' => ['This product already has an agreed price in your cart.'],
                        ]);
                    }
                    if (! $negotiation) {
                        throw ValidationException::withMessages([
                            'product_id' => ['This product is already in your cart at an agreed price.'],
                        ]);
                    }

                    // A negotiated line keeps the agreed quantity.
                    return $existing;
                }
                if ($negotiation) {
                    throw ValidationException::withMessages([
                        'product_id' => ['This product is already in your cart at the listed price.'],
                    ]);
                }
                $newQuantity = $existing->quantity + $quantity;
                $this->assertStock($product, $variant, $newQuantity);
                $existing->forceFill(['quantity' => $newQuantity])->save();

                return $existing;
            }

            $item = new CartItem;
            $item->forceFill([
                'cart_id' => $cart->id,
                'product_id' => $product->id,
                'product_variant_id' => $variant?->id,
                'negotiation_id' => $negotiation?->id,
                'quantity' => $quantity,
            ])->save();

            return $item;
        });
    }

    public function updateQuantity(User $user, CartItem $item, int $quantity): CartItem
    {
        return DB::transaction(function () use ($user, $item, $quantity) {
            $item = CartItem::query()->whereKey($item->id)->lockForUpdate()->firstOrFail();
            $this->assertOwner($user, $item);

            $item->loadMissing(['product', 'variant']);

            if ($item->negotiation_id) {
                $negotiation = $this->acceptedNegotiation($user, $item->negotiation_id);
                if ($quantity !== $negotiation->quantity) {
                    throw ValidationException::withMessages([
                        'quantity' => ['Negotiated items keep the quantity agreed with the seller.'],
                    ]);
                }
            }

            $this->assertPurchasable($user, $item->product, $item->variant, $quantity);
            $item->forceFill(['quantity' => $quantity])->save();

            return $item;
        });
    }

    public function remove(User $user, CartItem $item): void
    {
        $this->assertOwner($user, $item);
        $item->delete();
    }

    public function clear(User $user): void
    {
        CartItem::query()->where('cart_id', $this->cartFor($user)->id)->delete();
    }

    /** Full cart payload for the SPA: items, per-store groups, totals and issues. */
    public function summary(User $user): array
    {
        $cart = $this->cartFor($user);
        $items = $this->itemsQuery($cart)->get();

        $lines = $items->map(fn (CartItem $item) => $this->presentLine($user, $item))->values();
        $available = $lines->where('available', true);

        $groups = $available->groupBy(fn (array $line) => $line['store']['id'])
            ->map(function (Collection $storeLines) {
                $subtotal = round($storeLines->sum('line_total'), 2);
                $shipping = (float) Setting::get('checkout.default_shipping_cost', 0);

                return [
                    'store' => $storeLines->first()['store'],
                    'items' => $storeLines->values()->all(),
                    'subtotal' => $subtotal,
                    'shipping_cost' => $shipping,
                    'total' => round($subtotal + $shipping, 2),
                ];
            })->values();

        $subtotal = round($available->sum('line_total'), 2);
        $shipping = round($groups->sum('shipping_cost'), 2);

        return [
            'id' => $cart->id,
            'items' => $lines->all(),
            'groups' => $groups->all(),
            'item_count' => $lines->count(),
            'total_quantity' => (int) $lines->sum('quantity'),
            'subtotal' => $subtotal,
            'shipping_total' => $shipping,
            'total' => round($subtotal + $shipping, 2),
            'currency' => (string) Setting::get('checkout.currency', 'MAD'),
            'payment_method' => 'cod',
            'has_issues' => $lines->contains(fn (array $line) => ! $line['available']),
        ];
    }

    /**
     * Resolve cart lines for checkout, including optional accepted negotiations
     * that are not in the cart.
     *
     * @param  list<int>  $negotiationIds
     * @return array{lines: list<array<string, mixed>>, cart_item_ids: list<int>}
     */
    public function checkoutLines(User $user, array $negotiationIds = []): array
    {
        $cart = $this->cartFor($user);
        $items = $this->itemsQuery($cart)->lockForUpdate()->get();

        $lines = [];
        $consumed = [];

        foreach ($items as $item) {
            $negotiation = $item->negotiation_id
                ? $this->acceptedNegotiation($user, $item->negotiation_id)
                : null;

            $lines[] = $negotiation
                ? $this->negotiationLine($negotiation)
                : $this->listedLine($user, $item);

            $consumed[] = $item->id;
        }

        $alreadyIncluded = collect($lines)->pluck('negotiation_id')->filter()->all();

        foreach (array_unique($negotiationIds) as $negotiationId) {
            if (in_array($negotiationId, $alreadyIncluded, true)) {
                continue;
            }
            $negotiation = $this->acceptedNegotiation($user, (int) $negotiationId);
            $lines[] = $this->negotiationLine($negotiation);
        }

        return ['lines' => $lines, 'cart_item_ids' => $consumed];
    }

    /** @return \Illuminate\Database\Eloquent\Builder<CartItem> */
    private function itemsQuery(Cart $cart)
    {
        return CartItem::query()
            ->where('cart_id', $cart->id)
            ->with([
                'product.store',
                'product.primaryImage',
                'variant',
                'negotiation.acceptedOffer',
            ])
            ->orderBy('id');
    }

    /** @return array<string, mixed> */
    private function presentLine(User $user, CartItem $item): array
    {
        $product = $item->product;
        $variant = $item->variant;
        $negotiation = $item->negotiation_id ? $this->safeNegotiation($user, $item->negotiation_id) : null;

        $issues = [];
        $unitPrice = $variant?->price !== null ? (float) $variant->price : (float) $product?->price;
        $originalPrice = $unitPrice;

        if (! $product || $product->trashed() || $product->status !== ProductStatus::Published) {
            $issues[] = 'This product is no longer available.';
        }
        if (! $product?->store || $product->store->trashed() || $product->store->status !== StoreStatus::Active) {
            $issues[] = 'This store is not accepting orders right now.';
        }
        if ($product && $product->store?->user_id === $user->id) {
            $issues[] = 'You cannot buy from your own store.';
        }
        if ($variant && ($variant->trashed() || $variant->status !== VariantStatus::Active)) {
            $issues[] = 'The selected option is no longer available.';
        }

        if ($item->negotiation_id) {
            if (! $negotiation) {
                $issues[] = 'The agreed price is no longer valid.';
            } else {
                $unitPrice = (float) $negotiation->acceptedOffer->amount;
                $originalPrice = (float) ($negotiation->variant?->price ?? $negotiation->product?->price ?? $unitPrice);
                if ($negotiation->quantity !== $item->quantity) {
                    $issues[] = 'The negotiated quantity changed. Remove this line and add it again.';
                }
            }
        }

        $stock = $variant ? (int) $variant->stock_quantity : (int) ($product?->stock_quantity ?? 0);
        if ($stock < $item->quantity) {
            $issues[] = $stock === 0
                ? 'This item is out of stock.'
                : "Only {$stock} left in stock.";
        }

        return [
            'id' => $item->id,
            'quantity' => $item->quantity,
            'unit_price' => $unitPrice,
            'original_price' => $originalPrice,
            'line_total' => round($unitPrice * $item->quantity, 2),
            'stock_quantity' => $stock,
            'available' => $issues === [],
            'issues' => $issues,
            'is_negotiated' => $item->negotiation_id !== null,
            'negotiation_id' => $item->negotiation_id,
            'product' => $this->productPayload($product),
            'variant' => $this->variantPayload($variant),
            'store' => $this->storePayload($product?->store),
        ];
    }

    /** @return array<string, mixed> */
    private function listedLine(User $user, CartItem $item): array
    {
        $product = $item->product;
        $variant = $item->variant;

        if (! $product || $product->trashed() || $product->status !== ProductStatus::Published) {
            throw ValidationException::withMessages(['cart' => ['A product in your cart is no longer available.']]);
        }
        if (! $product->store || $product->store->trashed() || $product->store->status !== StoreStatus::Active) {
            throw ValidationException::withMessages(['cart' => ['A store in your cart is not accepting orders.']]);
        }
        if ($product->store->user_id === $user->id) {
            throw ValidationException::withMessages(['cart' => ['You cannot buy from your own store.']]);
        }
        if ($variant && ($variant->trashed() || $variant->status !== VariantStatus::Active)) {
            throw ValidationException::withMessages(['cart' => ['A selected product option is no longer available.']]);
        }

        $unitPrice = $variant?->price !== null ? (float) $variant->price : (float) $product->price;
        $this->assertStock($product, $variant, $item->quantity);

        return [
            'cart_item_id' => $item->id,
            'negotiation_id' => null,
            'product' => $product,
            'variant' => $variant,
            'quantity' => $item->quantity,
            'unit_price' => $unitPrice,
            'original_price' => $unitPrice,
            'store' => $product->store,
        ];
    }

    /** @return array<string, mixed> */
    private function negotiationLine(Negotiation $negotiation): array
    {
        $product = $negotiation->product;
        $variant = $negotiation->variant;

        if (! $product || $product->trashed() || $product->status !== ProductStatus::Published) {
            throw ValidationException::withMessages(['negotiation_id' => ['The negotiated product is no longer available.']]);
        }
        if (! $product->store || $product->store->trashed() || $product->store->status !== StoreStatus::Active) {
            throw ValidationException::withMessages(['negotiation_id' => ['The seller is not accepting orders right now.']]);
        }
        if ($variant && ($variant->trashed() || $variant->status !== VariantStatus::Active)) {
            throw ValidationException::withMessages(['negotiation_id' => ['The negotiated product option is no longer available.']]);
        }

        $amount = (float) $negotiation->acceptedOffer->amount;
        $original = (float) ($variant?->price ?? $product->price);

        $this->assertStock($product, $variant, $negotiation->quantity);

        return [
            'cart_item_id' => null,
            'negotiation_id' => $negotiation->id,
            'product' => $product,
            'variant' => $variant,
            'quantity' => $negotiation->quantity,
            'unit_price' => $amount,
            'original_price' => $original,
            'store' => $product->store,
        ];
    }

    /** Validate that an accepted negotiation may still be checked out by this customer. */
    public function acceptedNegotiation(User $user, int $negotiationId): Negotiation
    {
        /** @var Negotiation|null $negotiation */
        $negotiation = Negotiation::query()
            ->with(['product.store', 'variant', 'acceptedOffer'])
            ->whereKey($negotiationId)
            ->where('customer_id', $user->id)
            ->first();

        if (! $negotiation) {
            throw ValidationException::withMessages(['negotiation_id' => ['This negotiation does not belong to you.']]);
        }
        if ($negotiation->status !== NegotiationStatus::Accepted || ! $negotiation->acceptedOffer) {
            throw ValidationException::withMessages(['negotiation_id' => ['Only an accepted negotiation can be checked out.']]);
        }
        if ($negotiation->converted_order_id !== null || $negotiation->orderItem()->exists()) {
            throw ValidationException::withMessages(['negotiation_id' => ['This negotiation has already been converted into an order.']]);
        }
        if ($negotiation->expires_at && $negotiation->expires_at->isPast()) {
            throw ValidationException::withMessages(['negotiation_id' => ['The agreed price has expired. Ask the seller for a new offer.']]);
        }

        return $negotiation;
    }

    /** Same checks as acceptedNegotiation but returns null instead of throwing. */
    private function safeNegotiation(User $user, int $negotiationId): ?Negotiation
    {
        try {
            return $this->acceptedNegotiation($user, $negotiationId);
        } catch (ValidationException) {
            return null;
        }
    }

    private function assertOwner(User $user, CartItem $item): void
    {
        $item->loadMissing('cart');
        if ($item->cart->user_id !== $user->id) {
            throw ValidationException::withMessages(['cart' => ['This cart item does not belong to you.']]);
        }
    }

    private function assertPurchasable(User $user, Product $product, ?ProductVariant $variant, int $quantity): void
    {
        if ($product->trashed() || $product->status !== ProductStatus::Published) {
            throw ValidationException::withMessages(['product_id' => ['This product is not available.']]);
        }
        $product->loadMissing('store');
        if (! $product->store || $product->store->trashed() || $product->store->status !== StoreStatus::Active) {
            throw ValidationException::withMessages(['product_id' => ['This store is not accepting orders right now.']]);
        }
        if ($product->store->user_id === $user->id) {
            throw ValidationException::withMessages(['product_id' => ['You cannot add your own product to the cart.']]);
        }
        if ($variant && ($variant->trashed() || $variant->status !== VariantStatus::Active || $variant->product_id !== $product->id)) {
            throw ValidationException::withMessages(['product_variant_id' => ['The selected option is not available.']]);
        }
        if (! $variant && $product->variants()->exists()) {
            throw ValidationException::withMessages(['product_variant_id' => ['Choose one of the product options first.']]);
        }

        $this->assertStock($product, $variant, $quantity);
    }

    private function assertStock(Product $product, ?ProductVariant $variant, int $quantity): void
    {
        $stock = $variant ? (int) $variant->stock_quantity : (int) $product->stock_quantity;
        if ($stock < $quantity) {
            throw ValidationException::withMessages([
                'quantity' => [$stock === 0 ? 'This item is out of stock.' : "Only {$stock} left in stock."],
            ]);
        }
    }

    /** @return array<string, mixed> */
    private function productPayload(?Product $product): array
    {
        if (! $product) {
            return ['id' => 0, 'name' => 'Unavailable product', 'slug' => '', 'price' => 0, 'thumbnail_url' => null];
        }

        return [
            'id' => $product->id,
            'name' => $product->name,
            'slug' => $product->slug,
            'price' => (float) $product->price,
            'thumbnail_url' => $product->primaryImage?->thumbnailUrl(),
            'allow_negotiation' => $product->allow_negotiation,
            'status' => $product->status->value,
        ];
    }

    /** @return array<string, mixed>|null */
    private function variantPayload(?ProductVariant $variant): ?array
    {
        return $variant ? [
            'id' => $variant->id,
            'sku' => $variant->sku,
            'attributes' => $variant->getAttribute('attributes'),
            'price' => (float) ($variant->price ?? 0),
            'stock_quantity' => (int) $variant->stock_quantity,
            'status' => $variant->status->value,
        ] : null;
    }

    /** @return array<string, mixed>|null */
    private function storePayload(?object $store): ?array
    {
        return $store ? [
            'id' => $store->id,
            'name' => $store->name,
            'slug' => $store->slug,
            'logo_url' => method_exists($store, 'logoUrl') ? $store->logoUrl() : null,
        ] : null;
    }
}
