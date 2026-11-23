<?php

namespace App\Http\Requests\Dispute;

use App\Enums\DisputeStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ResolveDisputeRequest extends FormRequest
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
                DisputeStatus::UnderReview->value,
                DisputeStatus::Resolved->value,
                DisputeStatus::Rejected->value,
                DisputeStatus::Closed->value,
            ])],
            'resolution' => ['nullable', 'required_if:status,resolved,rejected', 'string', 'min:3', 'max:2000'],
        ];
    }
}
