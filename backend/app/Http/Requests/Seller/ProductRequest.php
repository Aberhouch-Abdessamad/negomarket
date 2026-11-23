<?php

namespace App\Http\Requests\Seller;

use App\Enums\CategoryStatus;
use App\Enums\VariantStatus;
use App\Models\Product;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * Create/update a product. Store ownership comes from the authenticated seller;
 * status, stock ledger, slug and counters are never accepted from the client.
 */
class ProductRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // seller.approved middleware + ProductPolicy (on update)
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        /** @var Product|null $product */
        $product = $this->route('product');
        $storeId = $this->user()->store->id;
        $hasVariants = filled($this->input('variants'));

        return [
            'name' => ['required', 'string', 'min:3', 'max:160'],
            'sku' => ['required', 'string', 'max:64', 'regex:/^[A-Za-z0-9._-]+$/',
                Rule::unique('products', 'sku')->where('store_id', $storeId)->ignore($product?->id)],
            'category_id' => ['required', 'integer', Rule::exists('categories', 'id')->where('status', CategoryStatus::Active->value)],
            'description' => ['nullable', 'string', 'max:20000'],
            'price' => ['required', 'numeric', 'gt:0', 'max:9999999999.99', 'decimal:0,2'],
            'allow_negotiation' => ['required', 'boolean'],
            'minimum_price' => ['nullable', 'required_if_accepted:allow_negotiation', 'numeric', 'gt:0', 'lte:price', 'decimal:0,2'],
            'stock_quantity' => [$hasVariants ? 'prohibited' : 'required', 'integer', 'min:0', 'max:1000000'],

            'variants' => ['nullable', 'array', 'max:50'],
            'variants.*.id' => ['nullable', 'integer', Rule::exists('product_variants', 'id')->where('product_id', $product?->id ?? 0)->whereNull('deleted_at')],
            'variants.*.sku' => ['required', 'string', 'max:64', 'regex:/^[A-Za-z0-9._-]+$/', 'distinct:ignore_case'],
            'variants.*.attributes' => ['required', 'array', 'min:1', 'max:4'],
            'variants.*.attributes.*' => ['required', 'string', 'max:40'],
            'variants.*.price' => ['nullable', 'numeric', 'gt:0', 'decimal:0,2'],
            'variants.*.stock_quantity' => ['required', 'integer', 'min:0', 'max:1000000'],
            'variants.*.status' => ['nullable', Rule::enum(VariantStatus::class)],
        ];
    }

    public function after(): array
    {
        return [function (Validator $validator) {
            $data = $this->all();

            // Every variant must use the same attribute keys, and combinations must be unique.
            $variants = $data['variants'] ?? [];
            if (is_array($variants) && $variants) {
                $keys = null;
                $combos = [];
                foreach ($variants as $i => $v) {
                    $attrs = (array) ($v['attributes'] ?? []);
                    ksort($attrs);
                    $k = array_keys($attrs);
                    $keys ??= $k;
                    if ($k !== $keys) {
                        $validator->errors()->add("variants.$i.attributes", 'All variants must use the same option names.');
                    }
                    $combo = json_encode(array_map('mb_strtolower', $attrs));
                    if (isset($combos[$combo])) {
                        $validator->errors()->add("variants.$i.attributes", 'This option combination already exists.');
                    }
                    $combos[$combo] = true;
                }
            }

            // The private minimum price must not exceed the cheapest variant price either.
            if (! empty($data['allow_negotiation']) && isset($data['minimum_price']) && is_array($variants)) {
                foreach ($variants as $i => $v) {
                    if (isset($v['price']) && is_numeric($v['price']) && (float) $data['minimum_price'] > (float) $v['price']) {
                        $validator->errors()->add('minimum_price', 'The minimum price must be less than or equal to every variant price.');
                        break;
                    }
                }
            }
        }];
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('sku')) {
            $this->merge(['sku' => strtoupper(trim((string) $this->input('sku')))]);
        }
        if (! $this->boolean('allow_negotiation')) {
            $this->merge(['minimum_price' => null]);
        }
    }

    public function messages(): array
    {
        return [
            'minimum_price.required_if_accepted' => 'Set your minimum acceptable price to enable negotiation.',
            'minimum_price.lte' => 'The minimum price must be less than or equal to the listed price.',
            'stock_quantity.prohibited' => 'Stock is managed per variant when variants are defined.',
        ];
    }
}
