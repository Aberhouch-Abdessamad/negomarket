<?php

namespace App\Http\Controllers\Api\V1\Seller;

use App\Http\Controllers\Controller;
use App\Http\Requests\Seller\StoreAddressRequest;
use App\Http\Requests\Seller\StoreImageRequest;
use App\Http\Requests\Seller\UpdateStoreRequest;
use App\Http\Resources\Seller\SellerStoreResource;
use App\Http\Resources\Seller\StoreAddressResource;
use App\Http\Responses\ApiResponse;
use App\Models\StoreAddress;
use App\Services\Store\StoreSettingsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** The seller's own store. The store is always resolved from the session, never from the URL. */
class StoreController extends Controller
{
    public function __construct(private readonly StoreSettingsService $settings) {}

    /** GET /seller/store */
    public function show(Request $request): JsonResponse
    {
        return ApiResponse::success(new SellerStoreResource($request->user()->store->load('addresses')));
    }

    /** PUT /seller/store */
    public function update(UpdateStoreRequest $request): JsonResponse
    {
        $store = $this->settings->update($request->user()->store, $request->validated(), $request->user());

        return ApiResponse::success(new SellerStoreResource($store->load('addresses')), 'Store updated.');
    }

    /** POST /seller/store/{kind} (kind = logo|banner, multipart image) */
    public function updateImage(StoreImageRequest $request, string $kind): JsonResponse
    {
        $store = $this->settings->updateImage($request->user()->store, $kind, $request->file('image'));

        return ApiResponse::success(new SellerStoreResource($store->load('addresses')), ucfirst($kind).' updated.');
    }

    /** POST /seller/store/addresses */
    public function storeAddress(StoreAddressRequest $request): JsonResponse
    {
        return ApiResponse::created(new StoreAddressResource($this->settings->saveAddress($request->user()->store, $request->validated())), 'Address saved.');
    }

    /** PUT /seller/store/addresses/{address} */
    public function updateAddress(StoreAddressRequest $request, StoreAddress $address): JsonResponse
    {
        $this->ensureOwned($request, $address);

        return ApiResponse::success(new StoreAddressResource($this->settings->saveAddress($request->user()->store, $request->validated(), $address)), 'Address updated.');
    }

    /** DELETE /seller/store/addresses/{address} */
    public function destroyAddress(Request $request, StoreAddress $address): JsonResponse
    {
        $this->ensureOwned($request, $address);
        $this->settings->deleteAddress($address);

        return ApiResponse::success(null, 'Address deleted.');
    }

    private function ensureOwned(Request $request, StoreAddress $address): void
    {
        abort_unless($address->store_id === $request->user()->store->id, 403, 'This action is unauthorized.');
    }
}
