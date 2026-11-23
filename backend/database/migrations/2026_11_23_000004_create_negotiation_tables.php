<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/*
 * Negotiation engine schema.
 *
 * Invariants enforced by the database (virtual generated columns + UNIQUE,
 * because MySQL has no partial indexes and NULLs never collide):
 *  - one ACTIVE negotiation per customer + product + variant
 *  - at most one PENDING offer per negotiation (one offer awaiting a response)
 *  - at most one ACCEPTED offer per negotiation
 * Offers are append-only: a counter-offer is a new row pointing at its parent.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('negotiations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->restrictOnDelete();
            $table->foreignId('product_variant_id')->nullable()->constrained()->restrictOnDelete();
            $table->foreignId('customer_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('store_id')->constrained()->restrictOnDelete();
            $table->unsignedSmallInteger('quantity')->default(1);
            $table->string('status', 32)->default('active');
            $table->timestamp('expires_at')->nullable();
            $table->unsignedBigInteger('accepted_offer_id')->nullable();
            $table->unsignedBigInteger('converted_order_id')->nullable();
            $table->timestamp('last_activity_at')->nullable();
            $table->timestamp('closed_at')->nullable();
            $table->timestamps();

            $table->string('active_key', 64)->nullable()
                ->virtualAs("IF(`status` = 'active', CONCAT(`customer_id`, ':', `product_id`, ':', IFNULL(`product_variant_id`, 0)), NULL)");
            $table->unique('active_key', 'negotiations_one_active_per_customer_product');
            $table->unique('accepted_offer_id');
            $table->unique('converted_order_id');
            $table->index(['store_id', 'status', 'last_activity_at']);
            $table->index(['customer_id', 'status', 'last_activity_at']);
            $table->index(['status', 'expires_at']);
        });

        Schema::create('negotiation_offers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('negotiation_id')->constrained()->cascadeOnDelete();
            $table->foreignId('sender_id')->constrained('users')->restrictOnDelete();
            $table->string('sender_role', 16);
            $table->foreignId('parent_offer_id')->nullable()->constrained('negotiation_offers')->nullOnDelete();
            $table->decimal('amount', 12, 2);
            $table->string('status', 32)->default('pending');
            $table->text('message')->nullable();
            $table->timestamp('expires_at');
            $table->timestamp('responded_at')->nullable();
            $table->foreignId('responded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unsignedBigInteger('pending_key')->nullable()
                ->virtualAs("IF(`status` = 'pending', `negotiation_id`, NULL)");
            $table->unsignedBigInteger('accepted_key')->nullable()
                ->virtualAs("IF(`status` = 'accepted', `negotiation_id`, NULL)");
            $table->unique('pending_key', 'negotiation_offers_one_pending');
            $table->unique('accepted_key', 'negotiation_offers_one_accepted');
            $table->index(['negotiation_id', 'created_at']);
            $table->index(['status', 'expires_at']);
        });

        Schema::table('negotiations', function (Blueprint $table) {
            $table->foreign('accepted_offer_id')->references('id')->on('negotiation_offers')->nullOnDelete();
        });

        Schema::create('messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('negotiation_id')->constrained()->cascadeOnDelete();
            $table->foreignId('sender_id')->constrained('users')->restrictOnDelete();
            $table->text('message')->nullable();
            $table->string('message_type', 16)->default('text');
            $table->foreignId('offer_id')->nullable()->constrained('negotiation_offers')->nullOnDelete();
            // Client-generated UUID: makes "send" idempotent across reconnects/retries.
            $table->uuid('client_message_id')->nullable();
            $table->timestamp('read_at')->nullable();
            $table->timestamps();

            $table->unique(['sender_id', 'client_message_id']);
            $table->index(['negotiation_id', 'id']);
            $table->index(['negotiation_id', 'read_at']);
        });

        if (DB::getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE negotiation_offers ADD CONSTRAINT negotiation_offers_amount_positive CHECK (amount > 0)');
            DB::statement('ALTER TABLE negotiations ADD CONSTRAINT negotiations_quantity_positive CHECK (quantity > 0)');
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('messages');
        Schema::table('negotiations', fn (Blueprint $table) => $table->dropForeign(['accepted_offer_id']));
        Schema::dropIfExists('negotiation_offers');
        Schema::dropIfExists('negotiations');
    }
};
