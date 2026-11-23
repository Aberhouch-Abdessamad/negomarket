<?php

namespace App\Http\Requests\Negotiation;

use Illuminate\Foundation\Http\FormRequest;

class NegotiationOfferRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'amount' => ['required', 'numeric', 'gt:0', 'max:9999999999.99', 'decimal:0,2'],
            'message' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
