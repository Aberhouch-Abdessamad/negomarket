<?php

namespace App\Services\Review;

use App\Enums\ReviewStatus;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\ProductReview;
use App\Models\Setting;
use App\Models\Store;
use App\Models\User;
use App\Notifications\Order\ReviewSubmittedNotification;
use App\Services\Audit\ActivityLogger;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Verified-purchase reviews: only the buyer of a delivered order line can
 * review it, and each order line can be reviewed once. Moderation is driven
 * by the reviews.require_moderation setting.
 */
class ReviewService
{
    public function __construct(private readonly ActivityLogger $activity) {}

    /**
     * @param  array{order_item_id: int, rating: int, comment?: string|null}  $data
     *
     * @throws ValidationException
     */
    public function create(User $actor, Order $order, array $data): ProductReview
    {
        $review = DB::transaction(function () use ($actor, $order, $data) {
            /** @var OrderItem|null $item */
            $item = OrderItem::query()
                ->with('product')
                ->where('order_id', $order->id)
                ->find($data['order_item_id']);

            if (! $item) {
                throw ValidationException::withMessages([
                    'order_item_id' => ['This item does not belong to the order.'],
                ]);
            }

            if (ProductReview::query()->where('order_item_id', $item->id)->exists()) {
                throw ValidationException::withMessages([
                    'order_item_id' => ['This item has already been reviewed.'],
                ]);
            }

            $moderated = (bool) Setting::get('reviews.require_moderation', true);

            $review = new ProductReview;
            $review->forceFill([
                'product_id' => $item->product_id,
                'user_id' => $actor->id,
                'order_item_id' => $item->id,
                'rating' => (int) $data['rating'],
                'comment' => $data['comment'] ?? null,
                'status' => $moderated ? ReviewStatus::Pending : ReviewStatus::Approved,
            ])->save();

            if (! $moderated && $item->product instanceof Product) {
                $this->refreshRating($item->product);
            }

            return $review;
        });

        $this->activity->log('review.submitted', $actor, $review, [
            'product_id' => $review->product_id,
            'rating' => $review->rating,
        ]);

        $review->load(['product.store.owner', 'author:id,name', 'orderItem']);
        $owner = $review->product?->store?->owner;
        if ($owner) {
            $owner->notify(new ReviewSubmittedNotification($review));
        }

        return $review;
    }

    /** Admin decision on a submitted review. Approving publishes it immediately. */
    public function moderate(User $admin, ProductReview $review, ReviewStatus $status): ProductReview
    {
        DB::transaction(function () use ($review, $status) {
            $review->forceFill(['status' => $status])->save();
            $review->loadMissing('product');
            if ($review->product instanceof Product) {
                $this->refreshRating($review->product);
            }
        });

        $this->activity->log('review.moderated', $admin, $review, [
            'product_id' => $review->product_id,
            'status' => $status->value,
        ]);

        return $review->fresh()->load(['author:id,name,email', 'product.store', 'orderItem.order:id,reference_number']);
    }

    /** Recompute a product's public rating and its store's aggregate rating. */
    public function refreshRating(Product $product): void
    {
        $stats = ProductReview::query()
            ->where('product_id', $product->id)
            ->where('status', ReviewStatus::Approved->value)
            ->selectRaw('COUNT(*) as total, COALESCE(AVG(rating), 0) as average')
            ->first();

        $product->forceFill([
            'rating_count' => (int) ($stats->total ?? 0),
            'rating_avg' => round((float) ($stats->average ?? 0), 2),
        ])->save();

        /** @var Store|null $store */
        $store = $product->store;
        if (! $store) {
            return;
        }

        $storeStats = DB::table('product_reviews as reviews')
            ->join('products', 'products.id', '=', 'reviews.product_id')
            ->where('products.store_id', $store->id)
            ->where('reviews.status', ReviewStatus::Approved->value)
            ->selectRaw('COUNT(*) as total, COALESCE(AVG(reviews.rating), 0) as average')
            ->first();

        $store->forceFill([
            'rating_count' => (int) ($storeStats->total ?? 0),
            'rating_avg' => round((float) ($storeStats->average ?? 0), 2),
        ])->save();
    }
}
