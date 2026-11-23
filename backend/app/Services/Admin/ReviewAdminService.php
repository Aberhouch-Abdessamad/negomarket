<?php

namespace App\Services\Admin;

use App\Enums\ReviewStatus;
use App\Models\ProductReview;
use App\Models\User;
use App\Services\Review\ReviewService;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;

/** Platform-wide review queue and moderation actions. */
class ReviewAdminService
{
    public function __construct(private readonly ReviewService $reviews) {}

    /** @param array<string, mixed> $filters */
    public function index(array $filters): LengthAwarePaginator
    {
        return ProductReview::query()
            ->when($filters['status'] ?? null, fn (Builder $q, string $status) => $q->where('status', $status))
            ->when($filters['rating'] ?? null, fn (Builder $q, int $rating) => $q->where('rating', $rating))
            ->when($filters['store_id'] ?? null, fn (Builder $q, int $storeId) => $q->whereHas(
                'product',
                fn (Builder $p) => $p->where('store_id', $storeId),
            ))
            ->when($filters['q'] ?? null, function (Builder $q, string $term) {
                $like = '%'.addcslashes($term, '\\%_').'%';
                $q->where(fn (Builder $w) => $w
                    ->where('comment', 'like', $like)
                    ->orWhereHas('author', fn (Builder $a) => $a
                        ->where('name', 'like', $like)
                        ->orWhere('email', 'like', $like))
                    ->orWhereHas('product', fn (Builder $p) => $p->where('name', 'like', $like)));
            })
            ->with([
                'author:id,name,email',
                'product:id,name,slug,store_id',
                'product.store:id,name,slug',
                'orderItem:id,order_id',
                'orderItem.order:id,reference_number',
            ])
            ->latest('id')
            ->paginate($filters['per_page'] ?? 20);
    }

    public function moderate(User $admin, ProductReview $review, ReviewStatus $status): ProductReview
    {
        return $this->reviews->moderate($admin, $review, $status);
    }
}
