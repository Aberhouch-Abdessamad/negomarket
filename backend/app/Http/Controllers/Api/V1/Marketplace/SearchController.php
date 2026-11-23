<?php

namespace App\Http\Controllers\Api\V1\Marketplace;

use App\Http\Controllers\Controller;
use App\Http\Resources\Marketplace\ProductCardResource;
use App\Http\Resources\Marketplace\StoreSummaryResource;
use App\Http\Responses\ApiResponse;
use App\Models\Category;
use App\Services\Marketplace\ProductCatalogService;
use App\Services\Marketplace\StoreDirectoryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SearchController extends Controller
{
    /** GET /search?q= – instant suggestions for the header search box */
    public function __invoke(Request $request, ProductCatalogService $products, StoreDirectoryService $stores): JsonResponse
    {
        $q = (string) $request->validate(['q' => ['required', 'string', 'min:2', 'max:100']])['q'];
        $like = '%'.addcslashes(trim($q), '\\%_').'%';

        return ApiResponse::success([
            'products' => ProductCardResource::collection($products->search(['q' => $q, 'per_page' => 6, 'sort' => 'popular'])->getCollection()),
            'stores' => StoreSummaryResource::collection($stores->search(['q' => $q, 'per_page' => 3])->getCollection()),
            'categories' => Category::query()->active()->where('name', 'like', $like)->limit(4)->get(['id', 'name', 'slug']),
        ]);
    }
}
