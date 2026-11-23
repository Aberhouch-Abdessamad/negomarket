<?php

namespace App\Http\Requests\Seller;

use App\Models\Product;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class InventoryAdjustRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // ownership checked below + in controller via ProductPolicy
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'product_id' => ['required', 'integer', Rule::exists('products', 'id')->whereNull('deleted_at')],
            'product_variant_id' => ['nullable', 'integer', Rule::exists('product_variants', 'id')->where('product_id', (int) $this->input('product_id'))->whereNull('deleted_at')],
            'mode' => ['required', Rule::in(['set', 'add', 'remove'])],
            'quantity' => ['required', 'integer', 'min:0', 'max:1000000'],
            'note' => ['nullable', 'string', 'max:255'],
        ];
    }

    public function after(): array
    {
        return [function (Validator $v) {
            $product = Product::query()->withCount('variants')->find($this->input('product_id'));
            if ($product && $product->variants_count > 0 && ! $this->filled('product_variant_id')) {
                $v->errors()->add('product_variant_id', 'Choose a variant: this product tracks stock per variant.');
            }
            if ($this->input('mode') !== 'set' && (int) $this->input('quantity') === 0) {
                $v->errors()->add('quantity', 'Enter a quantity greater than zero.');
            }
        }];
    }
}
