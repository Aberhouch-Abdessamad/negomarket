<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('store_applications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('business_name');
            $table->text('description')->nullable();
            $table->string('contact_phone', 32);
            $table->string('address');
            $table->string('city', 120);
            $table->string('status', 32)->default('pending');
            $table->text('admin_notes')->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();

            // A user can have at most one *pending* application (NULL never collides).
            $table->unsignedBigInteger('pending_key')->nullable()
                ->virtualAs("IF(`status` = 'pending', `user_id`, NULL)");
            $table->unique('pending_key', 'store_applications_one_pending_per_user');
            $table->index(['status', 'created_at']);
        });

        Schema::create('stores', function (Blueprint $table) {
            $table->id();
            // One store per user.
            $table->foreignId('user_id')->unique()->constrained()->restrictOnDelete();
            $table->foreignId('store_application_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name');
            $table->string('slug')->unique();
            $table->text('description')->nullable();
            $table->string('logo')->nullable();
            $table->string('banner')->nullable();
            $table->string('phone', 32)->nullable();
            $table->string('email')->nullable();
            $table->string('address')->nullable();
            $table->string('city', 120)->nullable();
            $table->string('status', 32)->default('pending');
            $table->decimal('rating_avg', 3, 2)->default(0);
            $table->unsignedInteger('rating_count')->default(0);
            $table->timestamp('approved_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['status', 'rating_avg']);
            $table->index('city');
        });

        Schema::create('store_addresses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('store_id')->constrained()->cascadeOnDelete();
            $table->string('type', 32)->default('business');
            $table->string('label', 64)->nullable();
            $table->string('contact_name')->nullable();
            $table->string('phone', 32)->nullable();
            $table->string('address_line1');
            $table->string('address_line2')->nullable();
            $table->string('city', 120);
            $table->string('region', 120)->nullable();
            $table->string('postal_code', 20)->nullable();
            $table->char('country', 2)->default('MA');
            $table->boolean('is_default')->default(false);
            $table->timestamps();

            $table->index(['store_id', 'type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('store_addresses');
        Schema::dropIfExists('stores');
        Schema::dropIfExists('store_applications');
    }
};
