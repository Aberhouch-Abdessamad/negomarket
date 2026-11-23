<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\ForgotPasswordRequest;
use App\Http\Requests\Auth\ResetPasswordRequest;
use App\Http\Responses\ApiResponse;
use App\Services\Auth\AuthService;
use Illuminate\Http\JsonResponse;

class PasswordResetController extends Controller
{
    public function __construct(private readonly AuthService $auth) {}

    /** POST /auth/forgot-password – same response whether or not the account exists. */
    public function forgot(ForgotPasswordRequest $request): JsonResponse
    {
        $this->auth->sendPasswordResetLink($request->validated('email'));

        return ApiResponse::success(null, 'If an account exists for that email, a password reset link has been sent.');
    }

    /** POST /auth/reset-password */
    public function reset(ResetPasswordRequest $request): JsonResponse
    {
        $this->auth->resetPassword(
            $request->validated('email'),
            $request->validated('token'),
            $request->validated('password'),
        );

        return ApiResponse::success(null, 'Your password has been reset. You can now sign in.');
    }
}
