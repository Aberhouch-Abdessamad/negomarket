<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Validator;

/**
 * Settings arrive as a flat map of dotted keys, e.g.
 * { "settings": { "negotiation.offer_expiry_hours": 48 } }.
 * Each known key is validated with its own rule after the base array check.
 */
class UpdateSettingsRequest extends FormRequest
{
    /** @var array<string, string> */
    private const RULES = [
        'negotiation.offer_expiry_hours' => 'integer|between:1,720',
        'negotiation.expiry_days' => 'integer|between:1,90',
        'negotiation.accepted_checkout_hours' => 'integer|between:1,720',
        'negotiation.max_open_per_customer' => 'integer|between:1,200',
        'checkout.currency' => 'string|size:3',
        'checkout.default_shipping_cost' => 'numeric|between:0,100000',
        'reviews.require_moderation' => 'boolean',
        'products.require_moderation' => 'boolean',
        'products.max_images' => 'integer|between:1,20',
    ];

    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'settings' => ['required', 'array', 'min:1'],
        ];
    }

    /** @param  \Illuminate\Validation\Validator  $validator */
    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            $settings = $this->input('settings', []);
            if (! is_array($settings)) {
                return;
            }

            foreach ($settings as $key => $value) {
                if (! array_key_exists($key, self::RULES)) {
                    $validator->errors()->add("settings.{$key}", 'This setting cannot be changed.');

                    continue;
                }

                $check = Validator::make(['value' => $value], ['value' => self::RULES[$key]]);
                if ($check->fails()) {
                    $validator->errors()->add("settings.{$key}", $check->errors()->first('value'));
                }
            }
        });
    }
}
