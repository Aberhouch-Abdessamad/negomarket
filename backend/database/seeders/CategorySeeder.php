<?php

namespace Database\Seeders;

use App\Enums\CategoryStatus;
use App\Models\Category;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/** Base category tree. Idempotent (matched by slug). */
class CategorySeeder extends Seeder
{
    public const TREE = [
        'Electronics' => ['Phones & Tablets', 'Laptops & Computers', 'Audio & Headphones', 'Cameras'],
        'Fashion' => ['Men', 'Women', 'Shoes', 'Bags & Accessories'],
        'Home & Living' => ['Furniture', 'Kitchen & Dining', 'Decor', 'Rugs & Textiles'],
        'Beauty & Health' => ['Skincare', 'Fragrances', 'Hair Care'],
        'Sports & Outdoors' => ['Fitness', 'Cycling', 'Camping'],
        'Arts & Crafts' => ['Handmade', 'Pottery & Ceramics', 'Leather Goods'],
    ];

    public function run(): void
    {
        $order = 0;
        foreach (self::TREE as $parentName => $children) {
            $parent = $this->upsert($parentName, null, $order++);
            foreach ($children as $i => $childName) {
                $this->upsert($childName, $parent->id, $i);
            }
        }
    }

    private function upsert(string $name, ?int $parentId, int $sortOrder): Category
    {
        return Category::query()->updateOrCreate(
            ['slug' => Str::slug($name)],
            ['name' => $name, 'parent_id' => $parentId, 'status' => CategoryStatus::Active, 'sort_order' => $sortOrder],
        );
    }
}
