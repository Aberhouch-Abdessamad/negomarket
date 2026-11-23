<?php

namespace App\Http\Requests\Dispute;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreDisputeRequest extends FormRequest
{
    public const REASONS = [
        'item_not_received',
        'item_damaged',
        'wrong_item',
        'not_as_described',
        'other',
    ];

    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'reason' => ['required', Rule::in(self::REASONS)],
            'description' => ['required', 'string', 'min:10', 'max:2000'],
        ];
    }
}
