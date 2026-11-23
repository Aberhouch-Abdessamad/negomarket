<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\ReviewStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ModerateReviewRequest;
use App\Http\Resources\Admin\ReviewAdminResource;
use App\Http\Responses\ApiResponse;
use App\Models\ProductReview;
use App\Services\Admin\ReviewAdminService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Review moderation queue across every store. */
class ReviewController extends Controller
{
    public function __construct(private readonly ReviewAdminService $reviews) {}

    /** GET /admin/reviews */
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'status' => ['nullable', Rule::enum(ReviewStatus::class)],
            'rating' => ['nullable', 'integer', 'between:1,5'],
            'store_id' => ['nullable', 'integer', 'min:1'],
            'q' => ['nullable', 'string', 'max:100'],
            'per_page' => ['nullable', 'integer', 'between:1,50'],
        ]);

        return ApiResponse::success(
            ReviewAdminResource::collection($this->reviews->index($filters)),
        );
    }

    /** PATCH /admin/reviews/{review} */
    public function moderate(ModerateReviewRequest $request, ProductReview $review): JsonResponse
    {
        $review = $this->reviews->moderate(
            $request->user(),
            $review,
            ReviewStatus::from($request->validated('status')),
        );

        return ApiResponse::success(new ReviewAdminResource($review), 'Review moderation saved.');
    }
}
