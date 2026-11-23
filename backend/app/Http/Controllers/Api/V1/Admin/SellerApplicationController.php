<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\StoreApplicationStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\Seller\StoreApplicationResource;
use App\Http\Responses\ApiResponse;
use App\Models\StoreApplication;
use App\Services\Store\SellerOnboardingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class SellerApplicationController extends Controller
{
    public function __construct(private readonly SellerOnboardingService $onboarding) {}

    /** GET /admin/seller-applications?status=pending&q= */
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'status' => ['nullable', Rule::enum(StoreApplicationStatus::class)],
            'q' => ['nullable', 'string', 'max:100'],
        ]);

        $applications = StoreApplication::query()
            ->with(['user:id,name,email,email_verified_at,created_at', 'reviewer:id,name', 'store:id,store_application_id,slug,status'])
            ->when($filters['status'] ?? null, fn ($q, $s) => $q->where('status', $s))
            ->when($filters['q'] ?? null, fn ($q, $t) => $q->where(fn ($w) => $w->where('business_name', 'like', '%'.addcslashes($t, '\\%_').'%')
                ->orWhereHas('user', fn ($u) => $u->where('email', 'like', '%'.addcslashes($t, '\\%_').'%'))))
            ->orderByRaw("status = 'pending' DESC")->latest('id')
            ->paginate(20);

        return ApiResponse::success(StoreApplicationResource::collection($applications), meta: [
            'pending_count' => StoreApplication::query()->pending()->count(),
        ]);
    }

    /** PATCH /admin/seller-applications/{application}/approve  { notes? } */
    public function approve(Request $request, StoreApplication $application): JsonResponse
    {
        $notes = $request->validate(['notes' => ['nullable', 'string', 'max:1000']])['notes'] ?? null;
        $application = $this->onboarding->approve($application, $request->user(), $notes);

        return ApiResponse::success(new StoreApplicationResource($application->load(['user', 'reviewer', 'store'])), 'Application approved. The store is now active.');
    }

    /** PATCH /admin/seller-applications/{application}/reject  { notes } */
    public function reject(Request $request, StoreApplication $application): JsonResponse
    {
        $notes = $request->validate(['notes' => ['required', 'string', 'min:5', 'max:1000']])['notes'];
        $application = $this->onboarding->reject($application, $request->user(), $notes);

        return ApiResponse::success(new StoreApplicationResource($application->load(['user', 'reviewer'])), 'Application rejected.');
    }
}
