<?php

namespace App\Http\Requests\Checkout;

use Illuminate\Foundation\Http\FormRequest;

/** Price a checkout. Nothing is written; totals are always recalculated server-side. */
class CheckoutPreviewRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'address_id' => ['nullable', 'integer', 'exists:user_addresses,id'],
            'address' => ['nullable', 'array'],
            'address.full_name' => ['required_with:address', 'string', 'min:2', 'max:120'],
            'address.phone' => ['required_with:address', 'string', 'regex:/^\+?[0-9 ]{8,20}$/'],
            'address.address_line1' => ['required_with:address', 'string', 'max:255'],
            'address.address_line2' => ['nullable', 'string', 'max:255'],
            'address.city' => ['required_with:address', 'string', 'max:120'],
            'address.region' => ['nullable', 'string', 'max:120'],
            'address.postal_code' => ['nullable', 'string', 'max:20'],
            'address.country' => ['sometimes', 'string', 'size:2', 'alpha'],
            'address.delivery_notes' => ['nullable', 'string', 'max:1000'],
            'negotiation_ids' => ['nullable', 'array', 'max:50'],
            'negotiation_ids.*' => ['integer', 'distinct', 'exists:negotiations,id'],
        ];
    }

    protected function prepareForValidation(): void
    {
        if (is_array($this->input('address')) && isset($this->input('address')['country'])) {
            $this->merge([
                'address' => array_merge($this->input('address'), [
                    'country' => strtoupper((string) $this->input('address')['country']),
                ]),
            ]);
        }
    }
}
