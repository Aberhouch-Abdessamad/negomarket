<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\UserStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UpdateUserStatusRequest;
use App\Http\Resources\Admin\UserAdminResource;
use App\Http\Responses\ApiResponse;
use App\Models\User;
use App\Services\Admin\UserAdminService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Account directory and suspension controls. */
class UserController extends Controller
{
    public function __construct(private readonly UserAdminService $users) {}

    /** GET /admin/users */
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'status' => ['nullable', Rule::enum(UserStatus::class)],
            'role' => ['nullable', Rule::in(['customer', 'seller', 'admin'])],
            'q' => ['nullable', 'string', 'max:100'],
            'per_page' => ['nullable', 'integer', 'between:1,50'],
        ]);

        return ApiResponse::success(
            UserAdminResource::collection($this->users->index($filters)),
        );
    }

    /** GET /admin/users/{user} */
    public function show(User $user): JsonResponse
    {
        return ApiResponse::success(new UserAdminResource($this->users->show($user)));
    }

    /** PATCH /admin/users/{user}/status */
    public function updateStatus(UpdateUserStatusRequest $request, User $user): JsonResponse
    {
        $user = $this->users->updateStatus(
            $request->user(),
            $user,
            UserStatus::from($request->validated('status')),
        );

        return ApiResponse::success(new UserAdminResource($user), 'Account status updated.');
    }
}
