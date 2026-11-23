<?php

namespace App\Services\Product;

use App\Models\Product;
use App\Models\ProductImage;
use App\Models\Setting;
use App\Services\Media\ImageProcessor;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

/**
 * Stores product images on the public disk under random names. When GD is
 * available, images are re-encoded to WebP (max 1600px) plus a 480px
 * thumbnail; re-encoding also strips EXIF metadata (e.g. GPS location).
 */
class ProductImageService
{
    public function __construct(private readonly ImageProcessor $processor) {}

    /** @param list<UploadedFile> $files */
    public function add(Product $product, array $files): void
    {
        $max = (int) Setting::get('products.max_images', 8);

        DB::transaction(function () use ($product, $files, $max) {
            Product::query()->whereKey($product->id)->lockForUpdate()->first();
            $count = $product->images()->count();

            if ($count + count($files) > $max) {
                throw ValidationException::withMessages(['images' => "A product can have at most {$max} images ({$count} already uploaded)."]);
            }

            $order = (int) $product->images()->max('sort_order');
            foreach ($files as $i => $file) {
                [$path, $thumb] = $this->store($product, $file);
                $product->images()->create([
                    'image_path' => $path,
                    'thumbnail_path' => $thumb,
                    'alt_text' => $product->name,
                    'sort_order' => $count === 0 && $i === 0 ? 0 : $order + $i + 1,
                ]);
            }
        });
    }

    public function delete(ProductImage $image): void
    {
        $paths = array_filter([$image->image_path, $image->thumbnail_path]);
        $image->delete();
        DB::afterCommit(fn () => Storage::disk('public')->delete($paths));
    }

    /** @param list<int> $orderedIds */
    public function reorder(Product $product, array $orderedIds): void
    {
        $owned = $product->images()->pluck('id')->all();
        if (array_diff($orderedIds, $owned) || count($orderedIds) !== count($owned)) {
            throw ValidationException::withMessages(['image_ids' => 'Provide every image id of this product exactly once.']);
        }

        DB::transaction(function () use ($orderedIds) {
            foreach ($orderedIds as $position => $id) {
                ProductImage::query()->whereKey($id)->update(['sort_order' => $position]);
            }
        });
    }

    /** @return array{0: string, 1: string|null} */
    private function store(Product $product, UploadedFile $file): array
    {
        $paths = $this->processor->store($file, "products/{$product->id}", ['main' => 1600, 'thumb' => 480]);

        return [$paths['main'], $paths['thumb'] !== $paths['main'] ? $paths['thumb'] : null];
    }
}
