<?php

namespace Tests\Feature\Api\V1;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Tests\TestCase;
use App\Models\Negotiation;
use App\Models\Product;
use App\Models\Store;

class BroadcastAuthTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        // Use the real Reverb (Pusher-protocol) broadcaster so channel auth is exercised.
        Config::set('broadcasting.default', 'reverb');
        Config::set('broadcasting.connections.reverb.key', 'test-key');
        Config::set('broadcasting.connections.reverb.secret', 'test-secret');
        Config::set('broadcasting.connections.reverb.app_id', 'test-app');
        // Channels were registered on the default (null) broadcaster at boot; register them on Reverb too.
        require base_path('routes/channels.php');
    }

    public function test_guest_cannot_authorize_private_channel(): void
    {
        $this->postJson('/api/broadcasting/auth', ['socket_id' => '1.1', 'channel_name' => 'private-users.1'])
            ->assertUnauthorized();
    }

    public function test_user_can_authorize_own_private_channel(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/broadcasting/auth', ['socket_id' => '1234.5678', 'channel_name' => "private-users.{$user->id}"])
            ->assertOk()
            ->assertJsonStructure(['auth']);
    }

    public function test_user_cannot_subscribe_to_another_users_private_channel(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/broadcasting/auth', ['socket_id' => '1234.5678', 'channel_name' => "private-users.{$other->id}"])
            ->assertForbidden();
    }

    public function test_only_negotiation_participants_can_authorize_the_private_negotiation_channel(): void
    {
        $seller = User::factory()->create();
        $store = Store::factory()->active()->for($seller, 'owner')->create();
        $product = Product::factory()->published()->for($store)->create();
        $customer = User::factory()->create();
        $negotiation = Negotiation::factory()->forProduct($product)->create(['customer_id' => $customer->id]);

        foreach ([$customer, $seller] as $participant) {
            $this->actingAs($participant, 'sanctum')
                ->postJson('/api/broadcasting/auth', [
                    'socket_id' => '1234.5678',
                    'channel_name' => "private-negotiations.{$negotiation->id}",
                ])
                ->assertOk()
                ->assertJsonStructure(['auth']);

            $this->app['auth']->forgetGuards();
        }

        $outsider = User::factory()->create();
        $this->actingAs($outsider, 'sanctum')
            ->postJson('/api/broadcasting/auth', [
                'socket_id' => '1234.5678',
                'channel_name' => "private-negotiations.{$negotiation->id}",
            ])
            ->assertForbidden();
    }
}
