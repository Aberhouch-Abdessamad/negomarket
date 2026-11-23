<?php

namespace App\Http\Controllers\Api\V1\Seller;

use App\Enums\ReviewStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\Seller\SellerReviewResource;
use App\Http\Responses\ApiResponse;
use App\Models\ProductReview;
use App\Services\Audit\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ReviewController extends Controller
{
    /** GET /seller/reviews */
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'rating' => ['nullable', 'integer', 'between:1,5'],
            'replied' => ['nullable', Rule::in(['yes', 'no'])],
        ]);

        $reviews = ProductReview::query()
            ->whereHas('product', fn ($q) => $q->withTrashed()->where('store_id', $request->user()->store->id))
            ->whereNot('status', ReviewStatus::Rejected)
            ->when($filters['rating'] ?? null, fn ($q, $r) => $q->where('rating', $r))
            ->when(($filters['replied'] ?? null) === 'yes', fn ($q) => $q->whereNotNull('seller_reply'))
            ->when(($filters['replied'] ?? null) === 'no', fn ($q) => $q->whereNull('seller_reply'))
            ->with(['author:id,name', 'product' => fn ($q) => $q->withTrashed()->select('id', 'name', 'slug')])
            ->latest('id')
            ->paginate(20);

        return ApiResponse::success(SellerReviewResource::collection($reviews));
    }

    /** POST /seller/reviews/{review}/reply  { reply } – one public reply, editable */
    public function reply(Request $request, ProductReview $review, ActivityLogger $activity): JsonResponse
    {
        abort_unless($review->product()->withTrashed()->value('store_id') === $request->user()->store->id, 403, 'This action is unauthorized.');
        $reply = $request->validate(['reply' => ['required', 'string', 'min:2', 'max:1000']])['reply'];

        $review->forceFill(['seller_reply' => $reply, 'seller_replied_at' => now()])->save();
        $activity->log('review.replied', $request->user(), $review);

        return ApiResponse::success(new SellerReviewResource($review->load(['author:id,name', 'product'])), 'Reply published.');
    }
}
