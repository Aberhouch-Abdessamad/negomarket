<?php

namespace App\Enums;

enum MessageType: string
{
    case Text = 'text';
    case Offer = 'offer';
    case System = 'system';

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }

    public function label(): string
    {
        return ucfirst(str_replace('_', ' ', $this->value));
    }
}
