<?php

namespace App\Enums;

enum StoreAddressType: string
{
    case Business = 'business';
    case Pickup = 'pickup';

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
