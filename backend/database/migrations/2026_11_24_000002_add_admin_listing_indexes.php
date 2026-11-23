<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Composite indexes backing the admin panel's filtered lists. Every admin
 * screen filters on a status (or subject type) and orders by newest id, so a
 * (filter, id) index keeps deep pages cheap as the marketplace grows.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->index(['status', 'id'], 'users_status_id_index');
        });

        Schema::table('stores', function (Blueprint $table) {
            $table->index(['status', 'id'], 'stores_status_id_index');
        });

        Schema::table('products', function (Blueprint $table) {
            $table->index(['status', 'id'], 'products_status_id_index');
        });

        Schema::table('product_reviews', function (Blueprint $table) {
            $table->index(['status', 'id'], 'product_reviews_status_id_index');
            $table->index(['rating', 'status', 'id'], 'product_reviews_rating_status_id_index');
        });

        Schema::table('negotiations', function (Blueprint $table) {
            $table->index(['status', 'last_activity_at'], 'negotiations_status_activity_index');
        });

        Schema::table('activity_logs', function (Blueprint $table) {
            $table->index(['subject_type', 'id'], 'activity_logs_subject_type_id_index');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex('users_status_id_index');
        });

        Schema::table('stores', function (Blueprint $table) {
            $table->dropIndex('stores_status_id_index');
        });

        Schema::table('products', function (Blueprint $table) {
            $table->dropIndex('products_status_id_index');
        });

        Schema::table('product_reviews', function (Blueprint $table) {
            $table->dropIndex('product_reviews_status_id_index');
            $table->dropIndex('product_reviews_rating_status_id_index');
        });

        Schema::table('negotiations', function (Blueprint $table) {
            $table->dropIndex('negotiations_status_activity_index');
        });

        Schema::table('activity_logs', function (Blueprint $table) {
            $table->dropIndex('activity_logs_subject_type_id_index');
        });
    }
};
