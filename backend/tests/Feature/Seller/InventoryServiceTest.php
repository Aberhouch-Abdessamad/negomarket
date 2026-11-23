<?php

namespace Tests\Feature\Seller;

use App\Enums\InventoryMovementType;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Services\Inventory\InventoryService;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class InventoryServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_adjustments_write_the_ledger_and_never_go_negative(): void
    {
        $service = app(InventoryService::class);
        $product = Product::factory()->create(['stock_quantity' => 0]);

        $service->initial($product, null, 5);
        $service->adjust($product, null, -2, InventoryMovementType::Sale);
        $this->assertSame(3, $product->fresh()->stock_quantity);

        try {
            $service->adjust($product, null, -4, InventoryMovementType::Sale);
            $this->fail('Expected insufficient stock.');
        } catch (ValidationException $e) {
            $this->assertStringContainsString('Insufficient stock', $e->errors()['stock_quantity'][0]);
        }

        $this->assertSame(3, $product->fresh()->stock_quantity);
        $this->assertSame([5, -2], $product->inventoryMovements()->orderBy('id')->pluck('quantity_change')->all());
    }

    public function test_variant_changes_keep_product_total_in_sync(): void
    {
        $service = app(InventoryService::class);
        $product = Product::factory()->create(['stock_quantity' => 0]);
        $a = ProductVariant::factory()->for($product)->create(['stock_quantity' => 0]);
        $b = ProductVariant::factory()->for($product)->create(['stock_quantity' => 0]);

        $service->initial($product, $a, 4);
        $service->initial($product, $b, 6);
        $service->setLevel($product, $a, 1);

        $this->assertSame(7, $product->fresh()->stock_quantity);
        $this->assertSame(7, (int) $product->inventoryMovements()->sum('quantity_change'));
    }

    public function test_same_reference_cannot_be_deducted_twice(): void
    {
        $service = app(InventoryService::class);
        $item = OrderItem::factory()->create();
        $product = Product::find($item->product_id);
        $service->initial($product, null, 10);

        $service->adjust($product, null, -1, InventoryMovementType::Sale, null, $item);

        $this->expectException(UniqueConstraintViolationException::class);
        $service->adjust($product, null, -1, InventoryMovementType::Sale, null, $item);
    }
}
