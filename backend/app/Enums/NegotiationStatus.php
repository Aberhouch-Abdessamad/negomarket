<?php

namespace App\Enums;

enum NegotiationStatus: string
{
    case Active = 'active';
    case Accepted = 'accepted';
    case Rejected = 'rejected';
    case Expired = 'expired';
    case Cancelled = 'cancelled';
    case ConvertedToOrder = 'converted_to_order';

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }

    public function label(): string
    {
        return ucfirst(str_replace('_', ' ', $this->value));
    }

    /** Statuses in which no further offers can be made. */
    public function isClosed(): bool
    {
        return $this !== self::Active && $this !== self::Accepted;
    }
}
