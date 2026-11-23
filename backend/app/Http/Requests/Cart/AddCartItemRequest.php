<?php

namespace App\Http\Requests\Cart;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Add a listed product or an accepted negotiation to the cart.
 * Prices and ownership are never accepted from the client.
 */
class AddCartItemRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'product_id' => ['required_without:negotiation_id', 'nullable', 'integer', 'exists:products,id'],
            'product_variant_id' => ['nullable', 'integer', 'exists:product_variants,id'],
            'negotiation_id' => ['nullable', 'integer', 'exists:negotiations,id'],
            'quantity' => ['required_without:negotiation_id', 'nullable', 'integer', 'min:1', 'max:1000'],
        ];
    }
}
