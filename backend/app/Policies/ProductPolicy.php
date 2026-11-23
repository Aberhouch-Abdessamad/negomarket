<?php

namespace App\Policies;

use App\Models\Product;
use App\Models\User;

/** Sellers manage only products of their own store. */
class ProductPolicy
{
    public function manage(User $user, Product $product): bool
    {
        return $user->store !== null && $product->store_id === $user->store->id;
    }

    public function moderate(User $user, Product $product): bool
    {
        return $user->hasPermissionTo('products.moderate');
    }
}
