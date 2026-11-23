<?php

namespace App\Http\Requests\Seller;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\File;

class StoreImageRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $min = $this->route('kind') === 'banner' ? 'min_width=800,min_height=200' : 'min_width=128,min_height=128';

        return ['image' => ['required', File::types(['jpg', 'jpeg', 'png', 'webp'])->max(5 * 1024), "dimensions:{$min},max_width=6000,max_height=6000"]];
    }
}
