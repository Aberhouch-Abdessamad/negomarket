<?php

namespace App\Http\Requests\Account;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\File;

class UpdateAvatarRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            // Content-sniffed image types only (no SVG: it can carry scripts).
            'avatar' => ['required', File::types(['jpg', 'jpeg', 'png', 'webp'])->max(2 * 1024), 'dimensions:min_width=64,min_height=64,max_width=4000,max_height=4000'],
        ];
    }
}
