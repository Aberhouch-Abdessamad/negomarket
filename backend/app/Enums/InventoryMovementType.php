<?php

namespace App\Enums;

enum InventoryMovementType: string
{
    case Initial = 'initial';
    case Restock = 'restock';
    case Adjustment = 'adjustment';
    case Sale = 'sale';
    case CancellationRestore = 'cancellation_restore';
    case ReturnRestore = 'return_restore';

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }

    public function label(): string
    {
        return ucfirst(str_replace('_', ' ', $this->value));
    }

    /** Movement types that add stock back. */
    public function isIncrease(): bool
    {
        return in_array($this, [self::Initial, self::Restock, self::CancellationRestore, self::ReturnRestore], true);
    }
}
