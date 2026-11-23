<?php

use App\Http\Controllers\Api\V1\Account\AddressController;
use App\Http\Controllers\Api\V1\Account\ProfileController;
use App\Http\Controllers\Api\V1\Account\WishlistController;
use App\Http\Controllers\Api\V1\Admin\ActivityLogController;
use App\Http\Controllers\Api\V1\Admin\DashboardController;
use App\Http\Controllers\Api\V1\Admin\NegotiationController as AdminNegotiationController;
use App\Http\Controllers\Api\V1\Admin\OrderController as AdminOrderController;
use App\Http\Controllers\Api\V1\Admin\ProductModerationController;
use App\Http\Controllers\Api\V1\Admin\ReportController;
use App\Http\Controllers\Api\V1\Admin\ReviewController as AdminReviewController;
use App\Http\Controllers\Api\V1\Admin\SellerApplicationController as AdminSellerApplicationController;
use App\Http\Controllers\Api\V1\Admin\SettingController as AdminSettingController;
use App\Http\Controllers\Api\V1\Admin\StoreController as AdminStoreController;
use App\Http\Controllers\Api\V1\Admin\UserController as AdminUserController;
use App\Http\Controllers\Api\V1\Auth\AuthController;
use App\Http\Controllers\Api\V1\Auth\PasswordResetController;
use App\Http\Controllers\Api\V1\Cart\CartController;
use App\Http\Controllers\Api\V1\Checkout\CheckoutController;
use App\Http\Controllers\Api\V1\Customer\OrderController as CustomerOrderController;
use App\Http\Controllers\Api\V1\Customer\ReviewController as CustomerReviewController;
use App\Http\Controllers\Api\V1\Dispute\DisputeController;
use App\Http\Controllers\Api\V1\HealthController;
use App\Http\Controllers\Api\V1\Marketplace\CategoryController;
use App\Http\Controllers\Api\V1\Marketplace\HomeController;
use App\Http\Controllers\Api\V1\Marketplace\ProductController;
use App\Http\Controllers\Api\V1\Marketplace\SearchController;
use App\Http\Controllers\Api\V1\Marketplace\StoreController;
use App\Http\Controllers\Api\V1\Negotiation\NegotiationController;
use App\Http\Controllers\Api\V1\Seller\ApplicationController as SellerApplicationController;
use App\Http\Controllers\Api\V1\Seller\DashboardController as SellerDashboardController;
use App\Http\Controllers\Api\V1\Seller\InventoryController as SellerInventoryController;
use App\Http\Controllers\Api\V1\Seller\OrderController as SellerOrderController;
use App\Http\Controllers\Api\V1\Seller\ProductController as SellerProductController;
use App\Http\Controllers\Api\V1\Seller\ProductImageController as SellerProductImageController;
use App\Http\Controllers\Api\V1\Seller\ReviewController as SellerReviewController;
use App\Http\Controllers\Api\V1\Seller\StoreController as SellerStoreController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| NegoMarket API – version 1
|--------------------------------------------------------------------------
| All endpoints live under /api/v1. Controllers stay thin and delegate to
| service classes in app/Services. Authenticated routes use the Sanctum
| session guard plus the "active" middleware (blocks suspended accounts).
*/

Route::prefix('v1')->name('api.v1.')->group(function () {
    Route::get('health', HealthController::class)->name('health');

    /* ------------------------------ Auth ------------------------------ */
    Route::prefix('auth')->name('auth.')->group(function () {
        Route::middleware('throttle:auth')->group(function () {
            Route::post('register', [AuthController::class, 'register'])->name('register');
            Route::post('login', [AuthController::class, 'login'])->name('login');
            // Bearer-token login for non-browser clients (curl, Postman, mobile).
            Route::post('token', [AuthController::class, 'token'])->name('token');
        });

        Route::middleware('throttle:auth')->group(function () {
            Route::post('forgot-password', [PasswordResetController::class, 'forgot'])->name('password.email');
            Route::post('reset-password', [PasswordResetController::class, 'reset'])->name('password.reset');
        });

        Route::middleware(['auth:sanctum', 'active'])->group(function () {
            Route::get('me', [AuthController::class, 'me'])->name('me');
            Route::post('logout', [AuthController::class, 'logout'])->name('logout');
        });
    });

    /* ---------------------------- Account ----------------------------- */
    Route::middleware(['auth:sanctum', 'active'])->prefix('profile')->name('profile.')->group(function () {
        Route::put('/', [ProfileController::class, 'update'])->name('update');
        Route::put('password', [ProfileController::class, 'updatePassword'])->middleware('throttle:auth')->name('password');
        Route::post('avatar', [ProfileController::class, 'updateAvatar'])->middleware('throttle:20,1')->name('avatar.update');
        Route::delete('avatar', [ProfileController::class, 'destroyAvatar'])->name('avatar.destroy');

        Route::get('addresses', [AddressController::class, 'index'])->name('addresses.index');
        Route::post('addresses', [AddressController::class, 'store'])->middleware('throttle:30,1')->name('addresses.store');
        Route::put('addresses/{address}', [AddressController::class, 'update'])->middleware('throttle:30,1')->name('addresses.update');
        Route::patch('addresses/{address}/default', [AddressController::class, 'makeDefault'])->middleware('throttle:30,1')->name('addresses.default');
        Route::delete('addresses/{address}', [AddressController::class, 'destroy'])->middleware('throttle:30,1')->name('addresses.destroy');
    });

    /* ------------------------ Public marketplace ---------------------- */
    Route::get('home', HomeController::class)->name('home');
    Route::get('search', SearchController::class)->middleware('throttle:60,1')->name('search');
    Route::get('categories', [CategoryController::class, 'index'])->name('categories.index');
    Route::get('categories/{slug}', [CategoryController::class, 'show'])->name('categories.show');
    Route::get('stores', [StoreController::class, 'index'])->name('stores.index');
    Route::get('stores/{slug}', [StoreController::class, 'show'])->name('stores.show');
    Route::get('products', [ProductController::class, 'index'])->name('products.index');
    Route::get('products/{product}/reviews', [ProductController::class, 'reviews'])->name('products.reviews');
    Route::get('products/{slug}/related', [ProductController::class, 'related'])->name('products.related');
    Route::get('products/{slug}', [ProductController::class, 'show'])->name('products.show');

    /* ---------------------------- Wishlist ---------------------------- */
    Route::middleware(['auth:sanctum', 'active'])->prefix('wishlist')->name('wishlist.')->group(function () {
        Route::get('/', [WishlistController::class, 'index'])->name('index');
        Route::get('ids', [WishlistController::class, 'ids'])->name('ids');
        Route::post('{product}', [WishlistController::class, 'store'])->whereNumber('product')->name('store');
        Route::delete('{product}', [WishlistController::class, 'destroy'])->whereNumber('product')->name('destroy');
    });

    /* -------------------------- Negotiations -------------------------- */
    Route::middleware(['auth:sanctum', 'active'])->prefix('negotiations')->name('negotiations.')->group(function () {
        Route::get('unread-count', [NegotiationController::class, 'unreadCount'])->name('unread-count');
        Route::get('/', [NegotiationController::class, 'index'])->name('index');
        Route::post('/', [NegotiationController::class, 'store'])->middleware(['permission:negotiations.create', 'throttle:20,1'])->name('store');
        Route::get('{negotiation}', [NegotiationController::class, 'show'])->whereNumber('negotiation')->name('show');
        Route::post('{negotiation}/offers', [NegotiationController::class, 'storeOffer'])->whereNumber('negotiation')->middleware('throttle:30,1')->name('offers.store');
        Route::post('{negotiation}/offers/{offer}/accept', [NegotiationController::class, 'accept'])->whereNumber(['negotiation', 'offer'])->middleware('throttle:30,1')->name('offers.accept');
        Route::post('{negotiation}/offers/{offer}/reject', [NegotiationController::class, 'reject'])->whereNumber(['negotiation', 'offer'])->middleware('throttle:30,1')->name('offers.reject');
        Route::post('{negotiation}/offers/{offer}/counter', [NegotiationController::class, 'counter'])->whereNumber(['negotiation', 'offer'])->middleware('throttle:30,1')->name('offers.counter');
        Route::post('{negotiation}/cancel', [NegotiationController::class, 'cancel'])->whereNumber('negotiation')->middleware('throttle:20,1')->name('cancel');
        Route::get('{negotiation}/messages', [NegotiationController::class, 'messages'])->whereNumber('negotiation')->name('messages.index');
        Route::post('{negotiation}/messages', [NegotiationController::class, 'sendMessage'])->whereNumber('negotiation')->middleware('throttle:60,1')->name('messages.store');
        Route::post('{negotiation}/read', [NegotiationController::class, 'markRead'])->whereNumber('negotiation')->name('read');
    });

    /* ------------------------------ Cart ------------------------------ */
    Route::middleware(['auth:sanctum', 'active'])->prefix('cart')->name('cart.')->group(function () {
        Route::get('/', [CartController::class, 'show'])->name('show');
        Route::post('items', [CartController::class, 'store'])->middleware('throttle:60,1')->name('items.store');
        Route::put('items/{item}', [CartController::class, 'update'])->whereNumber('item')->middleware('throttle:60,1')->name('items.update');
        Route::delete('items/{item}', [CartController::class, 'destroy'])->whereNumber('item')->middleware('throttle:60,1')->name('items.destroy');
    });

    /* ---------------------------- Checkout ---------------------------- */
    Route::middleware(['auth:sanctum', 'active'])->prefix('checkout')->name('checkout.')->group(function () {
        Route::post('preview', [CheckoutController::class, 'preview'])->middleware('throttle:60,1')->name('preview');
        Route::post('/', [CheckoutController::class, 'store'])->middleware('throttle:10,1')->name('store');
    });

    /* --------------------------- Customer orders ---------------------- */
    Route::middleware(['auth:sanctum', 'active'])->prefix('orders')->name('orders.')->group(function () {
        Route::get('/', [CustomerOrderController::class, 'index'])->name('index');
        Route::get('{order}', [CustomerOrderController::class, 'show'])->whereNumber('order')->name('show');
        Route::post('{order}/cancel', [CustomerOrderController::class, 'cancel'])->whereNumber('order')->middleware('throttle:30,1')->name('cancel');
        Route::post('{order}/receipt', [CustomerOrderController::class, 'confirmReceipt'])->whereNumber('order')->middleware('throttle:30,1')->name('receipt');
        Route::post('{order}/reviews', [CustomerReviewController::class, 'store'])->whereNumber('order')->middleware('throttle:20,1')->name('reviews.store');
        Route::post('{order}/disputes', [DisputeController::class, 'store'])->whereNumber('order')->middleware('throttle:10,1')->name('disputes.store');
    });

    Route::middleware(['auth:sanctum', 'active'])
        ->get('order-groups/{orderGroup}', [CustomerOrderController::class, 'showGroup'])
        ->whereNumber('orderGroup')
        ->name('order-groups.show');

    /* ----------------------------- Disputes --------------------------- */
    Route::middleware(['auth:sanctum', 'active'])->prefix('disputes')->name('disputes.')->group(function () {
        Route::get('/', [DisputeController::class, 'index'])->name('index');
        Route::get('{dispute}', [DisputeController::class, 'show'])->whereNumber('dispute')->name('show');
        Route::post('{dispute}/messages', [DisputeController::class, 'message'])->whereNumber('dispute')->middleware('throttle:60,1')->name('messages.store');
    });

    /* ----------------------- Seller onboarding ------------------------ */
    Route::middleware(['auth:sanctum', 'active'])->prefix('seller')->name('seller.')->group(function () {
        Route::get('application', [SellerApplicationController::class, 'show'])->name('application.show');
        Route::post('applications', [SellerApplicationController::class, 'store'])->middleware('throttle:5,1')->name('applications.store');
    });

    /* ------------------------------ Seller ---------------------------- */
    Route::middleware(['auth:sanctum', 'active', 'seller.approved'])->prefix('seller')->name('seller.')->group(function () {
        Route::get('dashboard', [SellerDashboardController::class, 'dashboard'])->name('dashboard');
        Route::get('analytics', [SellerDashboardController::class, 'analytics'])->name('analytics');

        Route::get('store', [SellerStoreController::class, 'show'])->name('store.show');
        Route::put('store', [SellerStoreController::class, 'update'])->middleware('throttle:30,1')->name('store.update');
        Route::post('store/{kind}', [SellerStoreController::class, 'updateImage'])->whereIn('kind', ['logo', 'banner'])->middleware('throttle:20,1')->name('store.image');
        Route::post('store/addresses', [SellerStoreController::class, 'storeAddress'])->middleware('throttle:30,1')->name('store.addresses.store');
        Route::put('store/addresses/{address}', [SellerStoreController::class, 'updateAddress'])->middleware('throttle:30,1')->name('store.addresses.update');
        Route::delete('store/addresses/{address}', [SellerStoreController::class, 'destroyAddress'])->middleware('throttle:30,1')->name('store.addresses.destroy');

        Route::get('inventory', [SellerInventoryController::class, 'index'])->name('inventory.index');
        Route::post('inventory/adjust', [SellerInventoryController::class, 'adjust'])->middleware('throttle:60,1')->name('inventory.adjust');
        Route::get('inventory/movements', [SellerInventoryController::class, 'movements'])->name('inventory.movements');

        Route::get('reviews', [SellerReviewController::class, 'index'])->name('reviews.index');
        Route::post('reviews/{review}/reply', [SellerReviewController::class, 'reply'])->middleware('throttle:30,1')->name('reviews.reply');

        Route::get('orders', [SellerOrderController::class, 'index'])->name('orders.index');
        Route::get('orders/{order}', [SellerOrderController::class, 'show'])->whereNumber('order')->name('orders.show');
        Route::patch('orders/{order}/status', [SellerOrderController::class, 'updateStatus'])->whereNumber('order')->middleware('throttle:30,1')->name('orders.status');
        Route::post('orders/{order}/cancel', [SellerOrderController::class, 'cancel'])->whereNumber('order')->middleware('throttle:30,1')->name('orders.cancel');
        Route::post('orders/{order}/payment/collect', [SellerOrderController::class, 'collectPayment'])->whereNumber('order')->middleware('throttle:30,1')->name('orders.payment.collect');

        Route::get('products', [SellerProductController::class, 'index'])->name('products.index');
        Route::post('products', [SellerProductController::class, 'store'])->middleware('throttle:30,1')->name('products.store');
        Route::get('products/{product:id}', [SellerProductController::class, 'show'])->name('products.show');
        Route::put('products/{product:id}', [SellerProductController::class, 'update'])->middleware('throttle:30,1')->name('products.update');
        Route::delete('products/{product:id}', [SellerProductController::class, 'destroy'])->middleware('throttle:30,1')->name('products.destroy');
        Route::post('products/{product:id}/publish', [SellerProductController::class, 'publish'])->middleware('throttle:30,1')->name('products.publish');
        Route::post('products/{product:id}/unpublish', [SellerProductController::class, 'unpublish'])->middleware('throttle:30,1')->name('products.unpublish');
        Route::post('products/{product:id}/images', [SellerProductImageController::class, 'store'])->middleware('throttle:30,1')->name('products.images.store');
        Route::patch('products/{product:id}/images/order', [SellerProductImageController::class, 'reorder'])->middleware('throttle:30,1')->name('products.images.reorder');
        Route::delete('products/{product:id}/images/{image}', [SellerProductImageController::class, 'destroy'])->middleware('throttle:30,1')->name('products.images.destroy');
    });

    /* ------------------------------ Admin ----------------------------- */
    Route::middleware(['auth:sanctum', 'active', 'role:admin'])->prefix('admin')->name('admin.')->group(function () {
        Route::get('dashboard', [DashboardController::class, 'index'])->name('dashboard');

        Route::middleware('permission:users.manage')->group(function () {
            Route::get('users', [AdminUserController::class, 'index'])->name('users.index');
            Route::get('users/{user}', [AdminUserController::class, 'show'])->whereNumber('user')->name('users.show');
            Route::patch('users/{user}/status', [AdminUserController::class, 'updateStatus'])->whereNumber('user')->middleware('throttle:30,1')->name('users.status');
        });

        Route::middleware('permission:stores.manage')->group(function () {
            Route::get('stores', [AdminStoreController::class, 'index'])->name('stores.index');
            Route::get('stores/{store}', [AdminStoreController::class, 'show'])->whereNumber('store')->name('stores.show');
            Route::patch('stores/{store}/status', [AdminStoreController::class, 'updateStatus'])->whereNumber('store')->middleware('throttle:30,1')->name('stores.status');
        });

        Route::middleware('permission:store-applications.review')->group(function () {
            Route::get('seller-applications', [AdminSellerApplicationController::class, 'index'])->name('seller-applications.index');
            Route::patch('seller-applications/{application}/approve', [AdminSellerApplicationController::class, 'approve'])->middleware('throttle:30,1')->name('seller-applications.approve');
            Route::patch('seller-applications/{application}/reject', [AdminSellerApplicationController::class, 'reject'])->middleware('throttle:30,1')->name('seller-applications.reject');
        });

        Route::middleware('permission:products.moderate')->group(function () {
            Route::get('products/moderation', [ProductModerationController::class, 'index'])->name('products.moderation');
            Route::patch('products/{product:id}/approve', [ProductModerationController::class, 'approve'])->middleware('throttle:30,1')->name('products.approve');
            Route::patch('products/{product:id}/reject', [ProductModerationController::class, 'reject'])->middleware('throttle:30,1')->name('products.reject');
        });

        Route::middleware('permission:orders.manage')->group(function () {
            Route::get('orders', [AdminOrderController::class, 'index'])->name('orders.index');
            Route::get('orders/{order}', [AdminOrderController::class, 'show'])->whereNumber('order')->name('orders.show');
            Route::patch('orders/{order}/status', [AdminOrderController::class, 'updateStatus'])->whereNumber('order')->middleware('throttle:30,1')->name('orders.status');
            Route::post('orders/{order}/cancel', [AdminOrderController::class, 'cancel'])->whereNumber('order')->middleware('throttle:30,1')->name('orders.cancel');
        });

        Route::middleware('permission:negotiations.monitor')->group(function () {
            Route::get('negotiations', [AdminNegotiationController::class, 'index'])->name('negotiations.index');
            Route::get('negotiations/{negotiation}', [AdminNegotiationController::class, 'show'])->whereNumber('negotiation')->name('negotiations.show');
        });

        Route::middleware('permission:disputes.manage')->group(function () {
            Route::get('disputes', [DisputeController::class, 'index'])->name('disputes.index');
            Route::get('disputes/{dispute}', [DisputeController::class, 'show'])->whereNumber('dispute')->name('disputes.show');
            Route::patch('disputes/{dispute}', [DisputeController::class, 'resolve'])->whereNumber('dispute')->middleware('throttle:30,1')->name('disputes.resolve');
        });

        Route::middleware('permission:reviews.moderate')->group(function () {
            Route::get('reviews', [AdminReviewController::class, 'index'])->name('reviews.index');
            Route::patch('reviews/{review}', [AdminReviewController::class, 'moderate'])->whereNumber('review')->middleware('throttle:30,1')->name('reviews.moderate');
        });

        Route::middleware('permission:reports.view')->group(function () {
            Route::get('reports/sales', [ReportController::class, 'sales'])->name('reports.sales');
        });

        Route::middleware('permission:activity-logs.view')->group(function () {
            Route::get('activity-logs', [ActivityLogController::class, 'index'])->name('activity-logs.index');
        });

        Route::middleware('permission:settings.manage')->group(function () {
            Route::get('settings', [AdminSettingController::class, 'index'])->name('settings.index');
            Route::put('settings', [AdminSettingController::class, 'update'])->middleware('throttle:10,1')->name('settings.update');
        });
    });
});
