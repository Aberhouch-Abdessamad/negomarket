<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Http\Requests\Auth\TokenRequest;
use App\Http\Resources\UserResource;
use App\Http\Responses\ApiResponse;
use App\Services\Auth\AuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuthController extends Controller
{
    public function __construct(private readonly AuthService $auth) {}

    /** POST /auth/register */
    public function register(RegisterRequest $request): JsonResponse
    {
        $user = $this->auth->register($request->safe()->only(['name', 'email', 'phone', 'password']), $request);

        return ApiResponse::created(
            new UserResource($user->loadAuthContext()),
            'Account created.',
        );
    }

    /** POST /auth/login */
    public function login(LoginRequest $request): JsonResponse
    {
        $user = $this->auth->login(
            $request->validated('email'),
            $request->validated('password'),
            $request->boolean('remember'),
            $request,
        );

        return ApiResponse::success(new UserResource($user->loadAuthContext()), 'Signed in.');
    }

    /** POST /auth/token */
    public function token(TokenRequest $request): JsonResponse
    {
        ['user' => $user, 'token' => $token] = $this->auth->issueToken(
            $request->validated('email'),
            $request->validated('password'),
            $request->validated('device_name') ?? 'api-client',
        );

        return ApiResponse::success([
            'token' => $token->plainTextToken,
            'token_type' => 'Bearer',
            'abilities' => ['*'],
            'user' => new UserResource($user->loadAuthContext()),
        ], 'Token issued.');
    }

    /** POST /auth/logout */
    public function logout(Request $request): JsonResponse
    {
        $this->auth->logout($request);

        return ApiResponse::success(null, 'Signed out.');
    }

    /** GET /auth/me */
    public function me(Request $request): JsonResponse
    {
        return ApiResponse::success(new UserResource($request->user()->loadAuthContext()));
    }
}
