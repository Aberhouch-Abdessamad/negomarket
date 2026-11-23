<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UpdateSettingsRequest;
use App\Http\Responses\ApiResponse;
use App\Services\Admin\SettingAdminService;
use Illuminate\Http\JsonResponse;

/** Platform settings editor. */
class SettingController extends Controller
{
    public function __construct(private readonly SettingAdminService $settings) {}

    /** GET /admin/settings */
    public function index(): JsonResponse
    {
        return ApiResponse::success($this->settings->all());
    }

    /** PUT /admin/settings */
    public function update(UpdateSettingsRequest $request): JsonResponse
    {
        $settings = $this->settings->update(
            $request->user(),
            $request->validated()['settings'] ?? [],
        );

        return ApiResponse::success($settings, 'Settings saved.');
    }
}
