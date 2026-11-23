<?php

namespace App\Http\Controllers\Api\V1\Account;

use App\Http\Controllers\Controller;
use App\Http\Requests\Account\UpdateAvatarRequest;
use App\Http\Requests\Account\UpdatePasswordRequest;
use App\Http\Requests\Account\UpdateProfileRequest;
use App\Http\Resources\UserResource;
use App\Http\Responses\ApiResponse;
use App\Services\Account\ProfileService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProfileController extends Controller
{
    public function __construct(private readonly ProfileService $profiles) {}

    /** PUT /profile */
    public function update(UpdateProfileRequest $request): JsonResponse
    {
        $user = $this->profiles->update($request->user(), $request->validated());

        return ApiResponse::success(new UserResource($user->loadAuthContext()), 'Profile updated.');
    }

    /** PUT /profile/password */
    public function updatePassword(UpdatePasswordRequest $request): JsonResponse
    {
        $this->profiles->updatePassword($request->user(), $request->validated('password'), $request);

        return ApiResponse::success(null, 'Password updated. Other sessions have been signed out.');
    }

    /** POST /profile/avatar (multipart) */
    public function updateAvatar(UpdateAvatarRequest $request): JsonResponse
    {
        $user = $this->profiles->updateAvatar($request->user(), $request->file('avatar'));

        return ApiResponse::success(new UserResource($user->loadAuthContext()), 'Profile photo updated.');
    }

    /** DELETE /profile/avatar */
    public function destroyAvatar(Request $request): JsonResponse
    {
        $user = $this->profiles->removeAvatar($request->user());

        return ApiResponse::success(new UserResource($user->loadAuthContext()), 'Profile photo removed.');
    }
}
