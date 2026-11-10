import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  availableQuantity,
  isPurchasable,
  reservationExpiresAt,
} from '../src/utils/inventory.js';
import { lineTotalPaise, netRevenuePaise, orderTotalPaise } from '../src/utils/money.js';

test('available quantity subtracts active reservations', () => {
  assert.equal(availableQuantity(3, 1), 2);
  assert.equal(availableQuantity(1, 1), 0);
});

test('unpublished artwork is not purchasable even with stock', () => {
  assert.equal(isPurchasable({
    status: 'draft',
    inventoryQuantity: 1,
    activeReservedQuantity: 0,
    requestedQuantity: 1,
  }), false);
});

test('published artwork with remaining stock is purchasable', () => {
  assert.equal(isPurchasable({
    status: 'published',
    inventoryQuantity: 2,
    activeReservedQuantity: 1,
    requestedQuantity: 1,
  }), true);
});

test('oversell attempts are rejected', () => {
  assert.equal(isPurchasable({
    status: 'published',
    inventoryQuantity: 1,
    activeReservedQuantity: 1,
    requestedQuantity: 1,
  }), false);
});

test('reservation expiry uses the configured TTL', () => {
  const now = new Date('2026-01-01T00:00:00.000Z');
  assert.equal(reservationExpiresAt(now, 900).toISOString(), '2026-01-01T00:15:00.000Z');
});

test('order totals and refund-aware revenue follow documented rules', () => {
  assert.equal(lineTotalPaise(2, 1500), 3000);
  assert.equal(orderTotalPaise({
    subtotalPaise: 3000,
    shippingPaise: 0,
    taxPaise: 0,
    discountPaise: 500,
  }), 2500);
  assert.equal(netRevenuePaise({
    capturedPaymentPaise: 10_000,
    succeededRefundPaise: 2500,
  }), 7500);
});
