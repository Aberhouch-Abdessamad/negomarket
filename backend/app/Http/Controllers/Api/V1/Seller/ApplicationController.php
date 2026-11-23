<?php

namespace App\Http\Controllers\Api\V1\Seller;

use App\Http\Controllers\Controller;
use App\Http\Requests\Seller\SellerApplicationRequest;
use App\Http\Resources\Seller\StoreApplicationResource;
use App\Http\Responses\ApiResponse;
use App\Services\Store\SellerOnboardingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ApplicationController extends Controller
{
    public function __construct(private readonly SellerOnboardingService $onboarding) {}

    /** GET /seller/application – the user's latest application (or null) */
    public function show(Request $request): JsonResponse
    {
        $application = $request->user()->storeApplications()->with('store')->latest('id')->first();

        return ApiResponse::success($application ? new StoreApplicationResource($application) : null);
    }

    /** POST /seller/applications */
    public function store(SellerApplicationRequest $request): JsonResponse
    {
        $application = $this->onboarding->apply($request->user(), $request->safe()->except('accept_seller_terms'));

        return ApiResponse::created(new StoreApplicationResource($application), 'Application submitted. We will review it shortly.');
    }
}
