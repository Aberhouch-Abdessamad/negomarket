<?php

namespace App\Http\Requests\Negotiation;

use Illuminate\Foundation\Http\FormRequest;

class MessageRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'message' => ['required', 'string', 'max:4000'],
            // Client-generated UUID so reconnects and retries cannot duplicate a message.
            'client_message_id' => ['required', 'uuid'],
        ];
    }
}
