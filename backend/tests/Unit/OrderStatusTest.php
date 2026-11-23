<?php

namespace Tests\Unit;

use App\Enums\NegotiationStatus;
use App\Enums\OrderStatus;
use PHPUnit\Framework\TestCase;

class OrderStatusTest extends TestCase
{
    public function test_order_status_transitions(): void
    {
        $this->assertTrue(OrderStatus::Pending->canTransitionTo(OrderStatus::Confirmed));
        $this->assertTrue(OrderStatus::Shipped->canTransitionTo(OrderStatus::Delivered));
        $this->assertFalse(OrderStatus::Delivered->canTransitionTo(OrderStatus::Pending));
        $this->assertFalse(OrderStatus::Cancelled->canTransitionTo(OrderStatus::Confirmed));
        $this->assertFalse(OrderStatus::Shipped->canTransitionTo(OrderStatus::Cancelled));
        $this->assertTrue(OrderStatus::Confirmed->isCancellableByCustomer());
        $this->assertFalse(OrderStatus::Shipped->isCancellableByCustomer());
    }

    public function test_negotiation_closed_states(): void
    {
        $this->assertFalse(NegotiationStatus::Active->isClosed());
        $this->assertFalse(NegotiationStatus::Accepted->isClosed());
        $this->assertTrue(NegotiationStatus::Expired->isClosed());
        $this->assertTrue(NegotiationStatus::ConvertedToOrder->isClosed());
    }
}
