<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('product_images', function (Blueprint $table) {
            // Optimised listing-size image (WebP, ~480px). Falls back to image_path when NULL.
            $table->string('thumbnail_path')->nullable()->after('image_path');
        });
    }

    public function down(): void
    {
        Schema::table('product_images', fn (Blueprint $table) => $table->dropColumn('thumbnail_path'));
    }
};
