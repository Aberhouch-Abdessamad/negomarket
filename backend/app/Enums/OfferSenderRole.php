<?php

namespace App\Enums;

enum OfferSenderRole: string
{
    case Customer = 'customer';
    case Seller = 'seller';

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
