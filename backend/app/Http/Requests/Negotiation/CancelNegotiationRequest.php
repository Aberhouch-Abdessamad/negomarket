<?php

namespace App\Http\Requests\Negotiation;

use Illuminate\Foundation\Http\FormRequest;

class CancelNegotiationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return ['reason' => ['nullable', 'string', 'max:500']];
    }
}
