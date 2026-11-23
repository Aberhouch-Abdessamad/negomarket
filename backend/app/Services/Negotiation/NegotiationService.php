<?php

namespace App\Services\Negotiation;

use App\Enums\NegotiationStatus;
use App\Enums\OfferSenderRole;
use App\Enums\OfferStatus;
use App\Enums\ProductStatus;
use App\Enums\StoreStatus;
use App\Enums\VariantStatus;
use App\Events\CounterOfferCreated;
use App\Events\NegotiationExpired;
use App\Events\OfferAccepted;
use App\Events\OfferCreated;
use App\Events\OfferRejected;
use App\Models\Negotiation;
use App\Models\NegotiationOffer;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Setting;
use App\Models\User;
use App\Notifications\NegotiationNotification;
use App\Services\Audit\ActivityLogger;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * The negotiation engine. Every state change is transactional, validates the
 * actor's role and the offer's recipient, and keeps an append-only offer history.
 *
 * Stock is deliberately NOT reserved while negotiating: availability is
 * re-checked when an offer is accepted and again at checkout.
 */
class NegotiationService
{
    public function __construct(private readonly ActivityLogger $activity) {}

    /** @param array<string, mixed> $data */
    public function startNegotiation(User $customer, array $data): Negotiation
    {
        /** @var Product $product */
        $product = Product::query()->with(['store', 'variants'])->findOrFail($data['product_id']);

        $this->assertProductNegotiable($product, $customer);

        $variant = null;
        if (! empty($data['product_variant_id'])) {
            $variant = $product->variants->firstWhere('id', (int) $data['product_variant_id']);
            if (! $variant || $variant->status !== VariantStatus::Active) {
                throw ValidationException::withMessages(['product_variant_id' => 'This product option is not available.']);
            }
        }

        $quantity = (int) ($data['quantity'] ?? 1);
        $unitPrice = $this->unitPrice($product, $variant);
        $this->assertAmountAllowed((string) $data['amount'], $unitPrice, null, 'amount');

        $available = $variant ? (int) $variant->stock_quantity : (int) $product->stock_quantity;
        if ($quantity < 1 || $quantity > $available) {
            throw ValidationException::withMessages(['quantity' => "Only {$available} unit(s) available."]);
        }

        $open = Negotiation::query()
            ->where('customer_id', $customer->id)
            ->tap(fn ($q) => $this->activeScope($q))
            ->where('product_id', $product->id)
            ->when($variant, fn ($q) => $q->where('product_variant_id', $variant->id))
            ->first();
        if ($open) {
            throw ValidationException::withMessages([
                'product_id' => 'You already have an active negotiation for this product.',
            ]);
        }

        $maxOpen = (int) Setting::get('negotiation.max_open_per_customer', 20);
        $openCount = Negotiation::query()->where('customer_id', $customer->id)
            ->tap(fn ($q) => $this->activeScope($q))->count();
        if ($openCount >= $maxOpen) {
            throw ValidationException::withMessages(['negotiation' => "You can have at most {$maxOpen} open negotiations."]);
        }

        return DB::transaction(function () use ($customer, $product, $variant, $quantity, $data, $unitPrice) {
            $negotiation = new Negotiation;
            $negotiation->forceFill([
                'product_id' => $product->id,
                'product_variant_id' => $variant?->id,
                'customer_id' => $customer->id,
                'store_id' => $product->store_id,
                'quantity' => $quantity,
                'status' => NegotiationStatus::Active,
                'expires_at' => $this->negotiationExpiry(),
                'last_activity_at' => now(),
            ])->save();

            $offer = $this->newOffer($negotiation, $customer, OfferSenderRole::Customer, $data['amount'], $data['message'] ?? null, null);

            if (! empty($data['message'])) {
                $this->storeOfferMessage($negotiation, $customer, $offer, (string) $data['message']);
            }

            $negotiation->load(['product', 'store.owner', 'customer', 'acceptedOffer']);

            $seller = $product->store->owner;
            $seller?->notify(new NegotiationNotification(
                $negotiation, 'negotiation.created', 'New price offer',
                "{$customer->name} offered ".$this->money($offer->amount)." for {$product->name}.",
                $offer->id,
            ));

            event(new OfferCreated($negotiation, $offer->load('sender')));
            $this->activity->log('negotiation.started', $customer, $negotiation, [
                'product_id' => $product->id,
                'amount' => (float) $offer->amount,
                'unit_price' => (float) $unitPrice,
            ]);

            return $negotiation->refresh();
        });
    }

    /** @param array<string, mixed> $data */
    public function createOffer(User $actor, Negotiation $negotiation, array $data): NegotiationOffer
    {
        return DB::transaction(function () use ($actor, $negotiation, $data) {
            /** @var Negotiation $negotiation */
            $negotiation = Negotiation::query()->lockForUpdate()->findOrFail($negotiation->id);
            $negotiation->loadMissing(['product', 'store', 'customer']);
            $this->assertOpen($negotiation);
            $this->assertParticipant($negotiation, $actor);

            /** @var NegotiationOffer|null $pending */
            $pending = NegotiationOffer::query()
                ->where('negotiation_id', $negotiation->id)
                ->where('status', OfferStatus::Pending)
                ->lockForUpdate()
                ->first();

            if (! $pending) {
                throw ValidationException::withMessages(['offer' => 'There is no offer awaiting a response.']);
            }
            if ($pending->sender_id === $actor->id) {
                throw ValidationException::withMessages(['offer' => 'Only the recipient of the pending offer can respond.']);
            }
            if ($pending->expires_at->isPast()) {
                throw ValidationException::withMessages(['offer' => 'This offer has expired.']);
            }

            $product = $negotiation->product;
            $variant = $negotiation->variant;
            $role = $this->roleFor($negotiation, $actor);
            $unitPrice = $this->unitPrice($product, $variant);
            $minimum = $role === OfferSenderRole::Seller ? $this->minimumPrice($product, $variant) : null;
            $this->assertAmountAllowed((string) $data['amount'], $unitPrice, $minimum, 'amount');

            $pending->forceFill([
                'status' => OfferStatus::Countered,
                'responded_at' => now(),
                'responded_by' => $actor->id,
            ])->save();

            $offer = $this->newOffer(
                $negotiation,
                $actor,
                $role,
                $data['amount'],
                $data['message'] ?? null,
                $pending->id,
            );

            if (! empty($data['message'])) {
                $this->storeOfferMessage($negotiation, $actor, $offer, (string) $data['message']);
            }

            $negotiation->forceFill(['last_activity_at' => now()])->save();

            $other = $this->otherParticipant($negotiation, $actor);
            $other?->notify(new NegotiationNotification(
                $negotiation, 'negotiation.counter_offer', 'New counter-offer',
                "{$actor->name} proposed ".$this->money($offer->amount)." for {$product->name}.",
                $offer->id,
            ));

            event(new CounterOfferCreated($negotiation, $offer->load('sender')));
            $this->activity->log('negotiation.offer_created', $actor, $negotiation, [
                'offer_id' => $offer->id,
                'amount' => (float) $offer->amount,
                'role' => $role->value,
            ]);

            return $offer->refresh();
        });
    }

    /**
     * A counter-offer is simply a new offer from the recipient of the latest
     * pending offer. Kept as a named method because the spec and API expose it.
     *
     * @param  array<string, mixed>  $data
     */
    public function createCounterOffer(User $actor, Negotiation $negotiation, array $data): NegotiationOffer
    {
        return $this->createOffer($actor, $negotiation, $data);
    }

    public function acceptOffer(User $actor, Negotiation $negotiation, NegotiationOffer $offer): Negotiation
    {
        return DB::transaction(function () use ($actor, $negotiation, $offer) {
            /** @var Negotiation $negotiation */
            $negotiation = Negotiation::query()->lockForUpdate()->findOrFail($negotiation->id);
            /** @var NegotiationOffer $offer */
            $offer = NegotiationOffer::query()->lockForUpdate()->findOrFail($offer->id);

            $this->assertOfferBelongs($negotiation, $offer);
            $this->assertOpen($negotiation);
            $this->assertParticipant($negotiation, $actor);
            $this->assertCanRespondTo($actor, $negotiation, $offer);

            if ($offer->status !== OfferStatus::Pending) {
                throw ValidationException::withMessages(['offer' => 'Only a pending offer can be accepted.']);
            }

            $negotiation->loadMissing(['product', 'customer']);

            $this->assertAvailable($negotiation);

            $offer->forceFill([
                'status' => OfferStatus::Accepted,
                'responded_at' => now(),
                'responded_by' => $actor->id,
            ])->save();

            $negotiation->forceFill([
                'status' => NegotiationStatus::Accepted,
                'accepted_offer_id' => $offer->id,
                'expires_at' => $this->acceptedCheckoutExpiry(),
                'last_activity_at' => now(),
                'closed_at' => null,
            ])->save();

            $isSeller = $negotiation->store?->user_id === $actor->id;
            $other = $this->otherParticipant($negotiation, $actor);
            $other?->notify(new NegotiationNotification(
                $negotiation,
                'negotiation.accepted',
                $isSeller ? 'Your offer was accepted' : 'Offer accepted',
                $isSeller
                    ? 'The seller accepted '.$this->money($offer->amount).'. You can now check out at the agreed price.'
                    : "{$actor->name} accepted ".$this->money($offer->amount)." for {$negotiation->product->name}. Complete checkout before the deadline.",
                $offer->id,
            ));

            event(new OfferAccepted($negotiation, $offer->load('sender')));
            $this->activity->log('negotiation.accepted', $actor, $negotiation, [
                'offer_id' => $offer->id,
                'amount' => (float) $offer->amount,
            ]);

            return $negotiation->refresh();
        });
    }

    public function rejectOffer(User $actor, Negotiation $negotiation, NegotiationOffer $offer): Negotiation
    {
        return DB::transaction(function () use ($actor, $negotiation, $offer) {
            /** @var Negotiation $negotiation */
            $negotiation = Negotiation::query()->lockForUpdate()->findOrFail($negotiation->id);
            /** @var NegotiationOffer $offer */
            $offer = NegotiationOffer::query()->lockForUpdate()->findOrFail($offer->id);

            $this->assertOfferBelongs($negotiation, $offer);
            $this->assertOpen($negotiation);
            $this->assertParticipant($negotiation, $actor);
            $this->assertCanRespondTo($actor, $negotiation, $offer);

            if ($offer->status !== OfferStatus::Pending) {
                throw ValidationException::withMessages(['offer' => 'Only a pending offer can be rejected.']);
            }

            $negotiation->loadMissing('product');

            $offer->forceFill([
                'status' => OfferStatus::Rejected,
                'responded_at' => now(),
                'responded_by' => $actor->id,
            ])->save();

            $negotiation->forceFill([
                'status' => NegotiationStatus::Rejected,
                'last_activity_at' => now(),
                'closed_at' => now(),
            ])->save();

            $this->otherParticipant($negotiation, $actor)?->notify(new NegotiationNotification(
                $negotiation, 'negotiation.rejected', 'Offer rejected',
                "{$actor->name} rejected the offer of ".$this->money($offer->amount)." for {$negotiation->product->name}.",
                $offer->id,
            ));

            event(new OfferRejected($negotiation, $offer->load('sender')));
            $this->activity->log('negotiation.rejected', $actor, $negotiation, ['offer_id' => $offer->id]);

            return $negotiation->refresh();
        });
    }

    public function cancelNegotiation(User $actor, Negotiation $negotiation, ?string $reason = null): Negotiation
    {
        return DB::transaction(function () use ($actor, $negotiation, $reason) {
            /** @var Negotiation $negotiation */
            $negotiation = Negotiation::query()->lockForUpdate()->findOrFail($negotiation->id);
            $this->assertParticipant($negotiation, $actor);
            $negotiation->loadMissing('product');

            if (in_array($negotiation->status, [NegotiationStatus::Cancelled, NegotiationStatus::Rejected, NegotiationStatus::Expired, NegotiationStatus::ConvertedToOrder], true)) {
                throw ValidationException::withMessages(['negotiation' => 'This negotiation is already closed.']);
            }

            NegotiationOffer::query()->where('negotiation_id', $negotiation->id)
                ->where('status', OfferStatus::Pending)
                ->update(['status' => OfferStatus::Withdrawn->value, 'responded_at' => now(), 'responded_by' => $actor->id]);

            $negotiation->forceFill([
                'status' => NegotiationStatus::Cancelled,
                'last_activity_at' => now(),
                'closed_at' => now(),
            ])->save();

            $this->otherParticipant($negotiation, $actor)?->notify(new NegotiationNotification(
                $negotiation, 'negotiation.cancelled', 'Negotiation cancelled',
                "{$actor->name} cancelled the negotiation for {$negotiation->product->name}.",
            ));

            $this->activity->log('negotiation.cancelled', $actor, $negotiation, array_filter(['reason' => $reason]));

            return $negotiation->refresh();
        });
    }

    public function expireNegotiation(Negotiation $negotiation, ?NegotiationOffer $offer = null): Negotiation
    {
        return DB::transaction(function () use ($negotiation, $offer) {
            /** @var Negotiation $negotiation */
            $negotiation = Negotiation::query()->lockForUpdate()->findOrFail($negotiation->id);

            if (! in_array($negotiation->status, [NegotiationStatus::Active, NegotiationStatus::Accepted], true)) {
                return $negotiation;
            }

            if ($offer) {
                NegotiationOffer::query()->whereKey($offer->id)->where('status', OfferStatus::Pending->value)
                    ->update(['status' => OfferStatus::Expired->value, 'responded_at' => now()]);
            }

            NegotiationOffer::query()->where('negotiation_id', $negotiation->id)
                ->where('status', OfferStatus::Pending->value)
                ->update(['status' => OfferStatus::Expired->value, 'responded_at' => now()]);

            $negotiation->forceFill([
                'status' => NegotiationStatus::Expired,
                'last_activity_at' => now(),
                'closed_at' => now(),
            ])->save();

            $negotiation->load(['product', 'store.owner', 'customer']);
            $negotiation->customer->notify(new NegotiationNotification(
                $negotiation, 'negotiation.expired', 'Negotiation expired',
                "The negotiation for {$negotiation->product->name} has expired.",
            ));
            $negotiation->store->owner?->notify(new NegotiationNotification(
                $negotiation, 'negotiation.expired', 'Negotiation expired',
                "The negotiation with {$negotiation->customer->name} for {$negotiation->product->name} has expired.",
            ));

            event(new NegotiationExpired($negotiation));
            $this->activity->log('negotiation.expired', null, $negotiation);

            return $negotiation->refresh();
        });
    }

    /** Run by the scheduler: close expired offers and missed accepted-checkout windows. */
    public function expireStale(): int
    {
        $count = 0;

        NegotiationOffer::query()
            ->where('status', OfferStatus::Pending->value)
            ->where('expires_at', '<=', now())
            ->with('negotiation')
            ->chunkById(100, function ($offers) use (&$count) {
                foreach ($offers as $offer) {
                    if ($offer->negotiation) {
                        $this->expireNegotiation($offer->negotiation, $offer);
                        $count++;
                    }
                }
            });

        Negotiation::query()
            ->whereIn('status', [NegotiationStatus::Active->value, NegotiationStatus::Accepted->value])
            ->whereNotNull('expires_at')
            ->where('expires_at', '<=', now())
            ->chunkById(100, function ($negotiations) use (&$count) {
                foreach ($negotiations as $negotiation) {
                    $this->expireNegotiation($negotiation);
                    $count++;
                }
            });

        return $count;
    }

    /**
     * Link an accepted negotiation to the order line created by CheckoutService.
     * Enforces the one-order-per-negotiation rule together with the unique index.
     */
    public function convertToOrder(Negotiation $negotiation, Order $order): Negotiation
    {
        return DB::transaction(function () use ($negotiation, $order) {
            /** @var Negotiation $negotiation */
            $negotiation = Negotiation::query()->lockForUpdate()->findOrFail($negotiation->id);

            if ($negotiation->status !== NegotiationStatus::Accepted) {
                throw ValidationException::withMessages(['negotiation' => 'Only an accepted negotiation can be converted to an order.']);
            }
            if ($negotiation->converted_order_id !== null) {
                throw ValidationException::withMessages(['negotiation' => 'This negotiation has already been converted to an order.']);
            }
            if ($negotiation->expires_at?->isPast()) {
                throw ValidationException::withMessages(['negotiation' => 'The accepted offer has expired.']);
            }
            if ($order->customer_id !== $negotiation->customer_id || $order->store_id !== $negotiation->store_id) {
                throw ValidationException::withMessages(['negotiation' => 'This order does not belong to the negotiation.']);
            }
            if (! $order->items()->where('negotiation_id', $negotiation->id)->exists()) {
                throw ValidationException::withMessages(['negotiation' => 'The order line for this negotiation is missing.']);
            }

            $negotiation->forceFill([
                'status' => NegotiationStatus::ConvertedToOrder,
                'converted_order_id' => $order->id,
                'last_activity_at' => now(),
                'closed_at' => now(),
            ])->save();

            $this->activity->log('negotiation.converted', $order->customer, $negotiation, ['order_id' => $order->id]);

            return $negotiation->refresh();
        });
    }

    /** @return array{0: Product, 1: ProductVariant|null} */
    public function resolveProduct(Negotiation $negotiation): array
    {
        return [$negotiation->product, $negotiation->variant];
    }

    public function unitPrice(Product $product, ?ProductVariant $variant): string
    {
        return number_format((float) ($variant?->price ?? $product->price), 2, '.', '');
    }

    public function minimumPrice(Product $product, ?ProductVariant $variant): ?string
    {
        return $product->minimum_price !== null ? number_format((float) $product->minimum_price, 2, '.', '') : null;
    }

    // ---------------------------------------------------------------------

    private function assertProductNegotiable(Product $product, User $customer): void
    {
        if ($product->status !== ProductStatus::Published || $product->trashed()) {
            throw ValidationException::withMessages(['product_id' => 'This product is not available.']);
        }
        if (! $product->store || $product->store->trashed() || $product->store->status !== StoreStatus::Active) {
            throw ValidationException::withMessages(['product_id' => 'This store is not accepting orders.']);
        }
        if (! $product->allow_negotiation) {
            throw ValidationException::withMessages(['product_id' => 'This product does not accept offers.']);
        }
        if ($product->store->user_id === $customer->id) {
            throw ValidationException::withMessages(['product_id' => 'You cannot negotiate with your own store.']);
        }
    }

    private function assertOpen(Negotiation $negotiation): void
    {
        if ($negotiation->status !== NegotiationStatus::Active) {
            throw ValidationException::withMessages(['negotiation' => 'This negotiation is no longer active.']);
        }
        if ($negotiation->expires_at?->isPast()) {
            throw ValidationException::withMessages(['negotiation' => 'This negotiation has expired.']);
        }
    }

    private function assertParticipant(Negotiation $negotiation, User $actor): void
    {
        $negotiation->loadMissing('store');
        if (! $negotiation->isParticipant($actor)) {
            throw ValidationException::withMessages(['negotiation' => 'You are not a participant in this negotiation.']);
        }
    }

    private function assertOfferBelongs(Negotiation $negotiation, NegotiationOffer $offer): void
    {
        if ((int) $offer->negotiation_id !== (int) $negotiation->id) {
            throw ValidationException::withMessages(['offer' => 'This offer does not belong to the negotiation.']);
        }
    }

    private function assertCanRespondTo(User $actor, Negotiation $negotiation, NegotiationOffer $offer): void
    {
        if ($offer->sender_id === $actor->id) {
            throw ValidationException::withMessages(['offer' => 'You cannot respond to your own offer.']);
        }
        if ($offer->status === OfferStatus::Pending && $offer->expires_at->isPast()) {
            throw ValidationException::withMessages(['offer' => 'This offer has expired.']);
        }
        $pending = NegotiationOffer::query()->where('negotiation_id', $negotiation->id)
            ->where('status', OfferStatus::Pending)->first();
        if (! $pending || $pending->id !== $offer->id) {
            throw ValidationException::withMessages(['offer' => 'Only the latest pending offer can be answered.']);
        }
    }

    private function assertAvailable(Negotiation $negotiation): void
    {
        /** @var Product $product */
        $product = Product::query()->lockForUpdate()->findOrFail($negotiation->product_id);
        $variant = $negotiation->product_variant_id
            ? ProductVariant::query()->lockForUpdate()->find($negotiation->product_variant_id)
            : null;

        if ($product->status !== ProductStatus::Published || $product->trashed()) {
            throw ValidationException::withMessages(['product' => 'This product is no longer available.']);
        }
        if ($variant && ($variant->trashed() || $variant->status !== VariantStatus::Active)) {
            throw ValidationException::withMessages(['product' => 'This product option is no longer available.']);
        }

        $available = $variant ? (int) $variant->stock_quantity : (int) $product->stock_quantity;
        if ($available < $negotiation->quantity) {
            throw ValidationException::withMessages(['stock' => 'The product is out of stock or has fewer units than requested.']);
        }
    }

    private function assertAmountAllowed(string $amount, string $ceiling, ?string $floor = null, string $field = 'amount'): void
    {
        $value = round((float) $amount, 2);
        if ($value <= 0) {
            throw ValidationException::withMessages([$field => 'Enter an amount greater than zero.']);
        }
        if ($value > (float) $ceiling) {
            throw ValidationException::withMessages([$field => 'The offer cannot exceed the listed price of '.$this->money($ceiling).'.']);
        }
        if ($floor !== null && $value < (float) $floor) {
            throw ValidationException::withMessages([$field => 'The counter-offer must be at least the seller minimum of '.$this->money($floor).'.']);
        }
    }

    private function roleFor(Negotiation $negotiation, User $actor): OfferSenderRole
    {
        return $negotiation->store?->user_id === $actor->id ? OfferSenderRole::Seller : OfferSenderRole::Customer;
    }

    private function otherParticipant(Negotiation $negotiation, User $actor): ?User
    {
        $negotiation->loadMissing('store');

        return $negotiation->customer_id === $actor->id
            ? $negotiation->store?->owner
            : $negotiation->customer;
    }

    private function newOffer(Negotiation $negotiation, User $sender, OfferSenderRole $role, mixed $amount, ?string $message, ?int $parentId): NegotiationOffer
    {
        $offer = new NegotiationOffer;
        $offer->forceFill([
            'negotiation_id' => $negotiation->id,
            'sender_id' => $sender->id,
            'sender_role' => $role,
            'parent_offer_id' => $parentId,
            'amount' => number_format(round((float) $amount, 2), 2, '.', ''),
            'status' => OfferStatus::Pending,
            'message' => $message,
            'expires_at' => $this->offerExpiry(),
        ])->save();

        $negotiation->forceFill(['last_activity_at' => now()])->save();

        return $offer;
    }

    private function storeOfferMessage(Negotiation $negotiation, User $sender, NegotiationOffer $offer, string $body): void
    {
        $message = new \App\Models\Message;
        $message->forceFill([
            'negotiation_id' => $negotiation->id,
            'sender_id' => $sender->id,
            'message' => $body,
            'message_type' => \App\Enums\MessageType::Offer,
            'offer_id' => $offer->id,
        ])->save();
    }

    private function offerExpiry(): CarbonImmutable
    {
        return CarbonImmutable::now()->addHours((int) Setting::get('negotiation.offer_expiry_hours', 48));
    }

    private function negotiationExpiry(): CarbonImmutable
    {
        return CarbonImmutable::now()->addDays((int) Setting::get('negotiation.expiry_days', 7));
    }

    private function acceptedCheckoutExpiry(): CarbonImmutable
    {
        return CarbonImmutable::now()->addHours((int) Setting::get('negotiation.accepted_checkout_hours', 48));
    }

    private function money(mixed $amount): string
    {
        return number_format((float) $amount, 2).' MAD';
    }

    private function activeScope($query): void
    {
        $query->where('status', NegotiationStatus::Active);
    }
}
