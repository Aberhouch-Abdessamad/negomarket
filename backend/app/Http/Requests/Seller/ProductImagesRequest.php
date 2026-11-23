<?php

namespace App\Http\Requests\Seller;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\File;

class ProductImagesRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'images' => ['required', 'array', 'min:1', 'max:8'],
            // Content-sniffed raster images only (SVG excluded: it can carry scripts).
            'images.*' => [File::types(['jpg', 'jpeg', 'png', 'webp'])->max(5 * 1024), 'dimensions:min_width=300,min_height=300,max_width=6000,max_height=6000'],
        ];
    }
}
