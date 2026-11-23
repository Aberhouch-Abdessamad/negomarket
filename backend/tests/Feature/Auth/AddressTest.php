<?php

namespace Tests\Feature\Auth;

use App\Models\UserAddress;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\ActsAsSpa;
use Tests\TestCase;

class AddressTest extends TestCase
{
    use ActsAsSpa, RefreshDatabase;

    private function address(array $overrides = []): array
    {
        return array_merge([
            'label' => 'Home', 'full_name' => 'Salma B', 'phone' => '0612345678',
            'address_line1' => '10 Rue Atlas', 'city' => 'Casablanca', 'country' => 'ma',
        ], $overrides);
    }

    public function test_first_address_becomes_default_and_only_one_default_exists(): void
    {
        $user = $this->customer();
        $this->actingAs($user);

        $first = $this->postJson('/api/v1/profile/addresses', $this->address())->assertCreated()
            ->assertJsonPath('data.is_default', true)->assertJsonPath('data.country', 'MA')->json('data.id');
        $second = $this->postJson('/api/v1/profile/addresses', $this->address(['label' => 'Work', 'is_default' => true]))
            ->assertCreated()->assertJsonPath('data.is_default', true)->json('data.id');

        $this->assertFalse(UserAddress::find($first)->is_default);

        $this->patchJson("/api/v1/profile/addresses/{$first}/default")->assertOk();
        $this->assertSame(1, $user->addresses()->where('is_default', true)->count());
        $this->assertTrue(UserAddress::find($first)->is_default);

        $this->deleteJson("/api/v1/profile/addresses/{$first}")->assertOk();
        $this->assertTrue(UserAddress::find($second)->is_default, 'Remaining address is promoted to default.');

        $this->getJson('/api/v1/profile/addresses')->assertOk()->assertJsonCount(1, 'data');
    }

    public function test_users_cannot_touch_other_users_addresses(): void
    {
        $owner = $this->customer();
        $address = UserAddress::factory()->for($owner)->create();
        $intruder = $this->customer();
        $this->actingAs($intruder);

        $this->putJson("/api/v1/profile/addresses/{$address->id}", $this->address())->assertForbidden();
        $this->patchJson("/api/v1/profile/addresses/{$address->id}/default")->assertForbidden();
        $this->deleteJson("/api/v1/profile/addresses/{$address->id}")->assertForbidden();
        $this->getJson('/api/v1/profile/addresses')->assertJsonCount(0, 'data');
        $this->assertDatabaseHas(UserAddress::class, ['id' => $address->id, 'full_name' => $address->full_name]);
    }

    public function test_address_validation_and_user_id_cannot_be_injected(): void
    {
        $user = $this->customer();
        $other = $this->customer();
        $this->actingAs($user);

        $this->postJson('/api/v1/profile/addresses', ['city' => ''])->assertJsonValidationErrors(['full_name', 'phone', 'address_line1', 'city']);

        $id = $this->postJson('/api/v1/profile/addresses', $this->address(['user_id' => $other->id]))->assertCreated()->json('data.id');
        $this->assertSame($user->id, UserAddress::find($id)->user_id);
    }
}
