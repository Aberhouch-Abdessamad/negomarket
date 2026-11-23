<?php

namespace App\Http\Requests\Seller;

use Illuminate\Foundation\Http\FormRequest;

class SellerApplicationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('store-applications.create');
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'business_name' => ['required', 'string', 'min:3', 'max:120'],
            'description' => ['required', 'string', 'min:20', 'max:2000'],
            'contact_phone' => ['required', 'string', 'regex:/^\+?[0-9 ]{8,20}$/'],
            'address' => ['required', 'string', 'max:255'],
            'city' => ['required', 'string', 'max:120'],
            'accept_seller_terms' => ['accepted'],
        ];
    }
}
