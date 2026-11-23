<?php

namespace App\Http\Controllers\Api\V1\Dispute;

use App\Enums\DisputeStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Dispute\DisputeMessageRequest;
use App\Http\Requests\Dispute\ResolveDisputeRequest;
use App\Http\Requests\Dispute\StoreDisputeRequest;
use App\Http\Resources\Dispute\DisputeResource;
use App\Http\Responses\ApiResponse;
use App\Models\Dispute;
use App\Models\Order;
use App\Services\Dispute\DisputeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/**
 * Shared dispute endpoints. The DisputePolicy limits visibility to the
 * customer, the store owner and administrators with disputes.manage.
 */
class DisputeController extends Controller
{
    public function __construct(private readonly DisputeService $disputes) {}

    /** GET /disputes */
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'status' => ['nullable', Rule::enum(DisputeStatus::class)],
            'order_id' => ['nullable', 'integer'],
            'per_page' => ['nullable', 'integer', 'between:1,50'],
        ]);

        return ApiResponse::success(
            DisputeResource::collection($this->disputes->index($request->user(), $filters)),
        );
    }

    /** GET /disputes/{dispute} */
    public function show(Dispute $dispute): JsonResponse
    {
        Gate::authorize('view', $dispute);

        return ApiResponse::success(new DisputeResource($this->disputes->show($dispute)));
    }

    /** POST /orders/{order}/disputes */
    public function store(StoreDisputeRequest $request, Order $order): JsonResponse
    {
        Gate::authorize('openDispute', $order);

        $dispute = $this->disputes->open($request->user(), $order, $request->validated());

        return ApiResponse::created(new DisputeResource($dispute), 'Dispute opened.');
    }

    /** POST /disputes/{dispute}/messages */
    public function message(DisputeMessageRequest $request, Dispute $dispute): JsonResponse
    {
        Gate::authorize('message', $dispute);

        $dispute = $this->disputes->message($request->user(), $dispute, $request->validated('message'));

        return ApiResponse::created(new DisputeResource($dispute), 'Message sent.');
    }

    /** PATCH /admin/disputes/{dispute} */
    public function resolve(ResolveDisputeRequest $request, Dispute $dispute): JsonResponse
    {
        Gate::authorize('resolve', $dispute);

        $dispute = $this->disputes->resolve(
            $request->user(),
            $dispute,
            DisputeStatus::from($request->validated('status')),
            $request->validated('resolution'),
        );

        return ApiResponse::success(new DisputeResource($dispute), 'Dispute updated.');
    }
}
