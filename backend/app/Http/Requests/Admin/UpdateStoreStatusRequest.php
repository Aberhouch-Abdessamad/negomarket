<?php

namespace App\Http\Requests\Admin;

use App\Enums\StoreStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateStoreStatusRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'status' => ['required', Rule::in([
                StoreStatus::Active->value,
                StoreStatus::Suspended->value,
                StoreStatus::Closed->value,
            ])],
        ];
    }
}
