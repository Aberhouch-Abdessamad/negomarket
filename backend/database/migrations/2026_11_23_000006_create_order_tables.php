<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/*
 * Multi-vendor orders: one order_group per checkout, one order per store.
 * Order items keep name / SKU / price snapshots so history never changes.
 * Order status and payment (COD) status are deliberately separate.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('order_groups', function (Blueprint $table) {
            $table->id();
            $table->foreignId('customer_id')->constrained('users')->restrictOnDelete();
            $table->string('reference_number', 32)->unique();
            // Client-supplied per checkout attempt; prevents duplicate submissions.
            $table->string('idempotency_key', 64);
            $table->string('payment_method', 16)->default('cod');
            $table->decimal('subtotal', 12, 2);
            $table->decimal('shipping_total', 12, 2)->default(0);
            $table->decimal('discount_total', 12, 2)->default(0);
            $table->decimal('total_amount', 12, 2);
            $table->string('status', 32)->default('pending');
            $table->timestamps();

            $table->unique(['customer_id', 'idempotency_key']);
            $table->index(['customer_id', 'created_at']);
            $table->index(['status', 'created_at']);
        });

        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_group_id')->constrained()->restrictOnDelete();
            $table->foreignId('store_id')->constrained()->restrictOnDelete();
            // Denormalised from the group for fast "my orders" / policy queries.
            $table->foreignId('customer_id')->constrained('users')->restrictOnDelete();
            $table->string('reference_number', 40)->unique();
            $table->decimal('subtotal', 12, 2);
            $table->decimal('shipping_cost', 12, 2)->default(0);
            $table->decimal('discount', 12, 2)->default(0);
            $table->decimal('total_amount', 12, 2);
            $table->string('status', 32)->default('pending');
            $table->text('customer_notes')->nullable();
            $table->timestamp('confirmed_at')->nullable();
            $table->timestamp('shipped_at')->nullable();
            $table->timestamp('delivered_at')->nullable();
            $table->timestamp('received_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->foreignId('cancelled_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('cancellation_reason')->nullable();
            $table->timestamps();

            $table->unique(['order_group_id', 'store_id']);
            $table->index(['store_id', 'status', 'created_at']);
            $table->index(['customer_id', 'created_at']);
            $table->index(['status', 'created_at']);
        });

        Schema::create('order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->restrictOnDelete();
            $table->foreignId('product_variant_id')->nullable()->constrained()->restrictOnDelete();
            // UNIQUE: an accepted negotiation can be converted into exactly one order line.
            $table->foreignId('negotiation_id')->nullable()->unique()->constrained()->restrictOnDelete();
            $table->string('product_name');
            $table->string('sku', 64);
            $table->json('variant_attributes')->nullable();
            $table->unsignedSmallInteger('quantity');
            $table->decimal('original_price', 12, 2);
            $table->decimal('unit_price', 12, 2);
            $table->decimal('total_price', 12, 2);
            $table->timestamps();

            $table->index(['product_id', 'created_at']);
        });

        Schema::create('order_addresses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('full_name');
            $table->string('phone', 32);
            $table->string('address_line1');
            $table->string('address_line2')->nullable();
            $table->string('city', 120);
            $table->string('region', 120)->nullable();
            $table->string('postal_code', 20)->nullable();
            $table->char('country', 2)->default('MA');
            $table->text('delivery_notes')->nullable();
            $table->timestamps();
        });

        Schema::create('order_status_histories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->string('from_status', 32)->nullable();
            $table->string('to_status', 32);
            $table->foreignId('changed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('note')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['order_id', 'created_at']);
        });

        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('payment_method', 16)->default('cod');
            $table->decimal('amount', 12, 2);
            $table->string('status', 32)->default('unpaid');
            $table->timestamp('collected_at')->nullable();
            $table->foreignId('collected_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('notes')->nullable();
            $table->timestamps();

            $table->index(['status', 'collected_at']);
        });

        Schema::table('negotiations', function (Blueprint $table) {
            $table->foreign('converted_order_id')->references('id')->on('orders')->nullOnDelete();
        });

        Schema::create('product_reviews', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            // One review per purchased order line.
            $table->foreignId('order_item_id')->unique()->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('rating');
            $table->text('comment')->nullable();
            $table->string('status', 32)->default('pending');
            $table->text('seller_reply')->nullable();
            $table->timestamp('seller_replied_at')->nullable();
            $table->timestamps();

            $table->index(['product_id', 'status', 'created_at']);
            $table->index(['user_id', 'created_at']);
        });

        if (DB::getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE order_items ADD CONSTRAINT order_items_quantity_positive CHECK (quantity > 0)');
            DB::statement('ALTER TABLE order_items ADD CONSTRAINT order_items_prices_valid CHECK (unit_price >= 0 AND original_price >= 0 AND total_price >= 0)');
            DB::statement('ALTER TABLE orders ADD CONSTRAINT orders_totals_valid CHECK (subtotal >= 0 AND total_amount >= 0)');
            DB::statement('ALTER TABLE payments ADD CONSTRAINT payments_amount_valid CHECK (amount >= 0)');
            DB::statement('ALTER TABLE product_reviews ADD CONSTRAINT product_reviews_rating_range CHECK (rating BETWEEN 1 AND 5)');
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('product_reviews');
        Schema::table('negotiations', fn (Blueprint $table) => $table->dropForeign(['converted_order_id']));
        Schema::dropIfExists('payments');
        Schema::dropIfExists('order_status_histories');
        Schema::dropIfExists('order_addresses');
        Schema::dropIfExists('order_items');
        Schema::dropIfExists('orders');
        Schema::dropIfExists('order_groups');
    }
};
