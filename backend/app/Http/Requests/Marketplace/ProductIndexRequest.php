<?php

namespace App\Http\Requests\Marketplace;

use App\Services\Marketplace\ProductCatalogService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ProductIndexRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'q' => ['nullable', 'string', 'max:100'],
            'category' => ['nullable', 'string', 'max:120'],
            'store' => ['nullable', 'string', 'max:160'],
            'min_price' => ['nullable', 'numeric', 'min:0'],
            'max_price' => ['nullable', 'numeric', 'min:0', 'gte:min_price'],
            'negotiable' => ['nullable', 'boolean'],
            'min_rating' => ['nullable', 'numeric', 'between:1,5'],
            'in_stock' => ['nullable', 'boolean'],
            'sort' => ['nullable', Rule::in(ProductCatalogService::SORTS)],
            'per_page' => ['nullable', 'integer', 'between:1,48'],
            'page' => ['nullable', 'integer', 'min:1'],
        ];
    }

    /** @return array<string, mixed> */
    public function filters(): array
    {
        $data = $this->validated();
        foreach (['negotiable', 'in_stock'] as $flag) {
            if (array_key_exists($flag, $data)) {
                $data[$flag] = $this->boolean($flag);
            }
        }

        return $data;
    }
}
