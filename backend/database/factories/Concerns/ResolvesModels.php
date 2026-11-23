<?php

namespace Database\Factories\Concerns;

use Illuminate\Database\Eloquent\Model;

trait ResolvesModels
{
    /**
     * Resolve a foreign-key attribute that may already be a model instance
     * (when using ->for()) or a plain id.
     *
     * @template T of Model
     *
     * @param  class-string<T>  $class
     * @return T
     */
    protected static function resolve(string $class, mixed $value, array $with = []): Model
    {
        if ($value instanceof $class) {
            return $with ? $value->loadMissing($with) : $value;
        }

        return $class::query()->with($with)->findOrFail($value instanceof Model ? $value->getKey() : $value);
    }
}
