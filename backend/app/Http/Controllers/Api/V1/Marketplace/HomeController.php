<?php

namespace App\Http\Controllers\Api\V1\Marketplace;

use App\Http\Controllers\Controller;
use App\Http\Responses\ApiResponse;
use App\Services\Marketplace\HomeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class HomeController extends Controller
{
    /** GET /home */
    public function __invoke(Request $request, HomeService $home): JsonResponse
    {
        return ApiResponse::success($home->sections($request));
    }
}
