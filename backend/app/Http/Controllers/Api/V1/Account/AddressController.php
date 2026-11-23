<?php

namespace App\Http\Controllers\Api\V1\Account;

use App\Http\Controllers\Controller;
use App\Http\Requests\Account\UserAddressRequest;
use App\Http\Resources\UserAddressResource;
use App\Http\Responses\ApiResponse;
use App\Models\UserAddress;
use App\Services\Account\AddressService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class AddressController extends Controller
{
    public function __construct(private readonly AddressService $addresses) {}

    /** GET /profile/addresses */
    public function index(Request $request): JsonResponse
    {
        $list = $request->user()->addresses()->orderByDesc('is_default')->orderBy('id')->get();

        return ApiResponse::success(UserAddressResource::collection($list));
    }

    /** POST /profile/addresses */
    public function store(UserAddressRequest $request): JsonResponse
    {
        abort_if($request->user()->addresses()->count() >= 10, 422, 'You can save up to 10 addresses.');

        $address = $this->addresses->create($request->user(), $request->validated());

        return ApiResponse::created(new UserAddressResource($address), 'Address saved.');
    }

    /** PUT /profile/addresses/{address} */
    public function update(UserAddressRequest $request, UserAddress $address): JsonResponse
    {
        Gate::authorize('update', $address);

        return ApiResponse::success(new UserAddressResource($this->addresses->update($address, $request->validated())), 'Address updated.');
    }

    /** PATCH /profile/addresses/{address}/default */
    public function makeDefault(UserAddress $address): JsonResponse
    {
        Gate::authorize('update', $address);

        return ApiResponse::success(new UserAddressResource($this->addresses->setDefault($address)), 'Default address updated.');
    }

    /** DELETE /profile/addresses/{address} */
    public function destroy(UserAddress $address): JsonResponse
    {
        Gate::authorize('delete', $address);
        $this->addresses->delete($address);

        return ApiResponse::success(null, 'Address deleted.');
    }
}
