<?php

namespace App\Http\Controllers\Api\V1\Customer;

use App\Http\Controllers\Controller;
use App\Http\Requests\Order\StoreReviewRequest;
use App\Http\Resources\Order\ReviewResource;
use App\Http\Responses\ApiResponse;
use App\Models\Order;
use App\Services\Review\ReviewService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

class ReviewController extends Controller
{
    public function __construct(private readonly ReviewService $reviews) {}

    /** POST /orders/{order}/reviews */
    public function store(StoreReviewRequest $request, Order $order): JsonResponse
    {
        Gate::authorize('review', $order);

        $review = $this->reviews->create($request->user(), $order, $request->validated());

        return ApiResponse::created(
            new ReviewResource($review),
            $review->status->value === 'approved'
                ? 'Thank you for your review.'
                : 'Thank you! Your review will appear after moderation.',
        );
    }
}
