import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  createCheckoutOrder,
  lineItemsFromLockedArtworks,
} from '../src/services/checkout.service.js';
import { expireStaleReservations } from '../src/services/inventory.service.js';
import { ApiError } from '../src/utils/ApiError.js';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const firstId = '11111111-1111-4111-8111-111111111111';
const secondId = '22222222-2222-4222-8222-222222222222';
const shippingAddress = {
  recipientName: 'Collector',
  phone: '+919999999999',
  addressLine1: '1 Atelier Road',
  city: 'Mumbai',
  state: 'MH',
  postalCode: '400001',
  country: 'IN',
};

function publishedArtwork(id, extras = {}) {
  return {
    id,
    title: extras.title || `Work ${id.slice(0, 8)}`,
    slug: extras.slug || `work-${id.slice(0, 8)}`,
    artistName: 'Artist',
    pricePaise: extras.pricePaise ?? 250000,
    currency: 'INR',
    status: extras.status || 'published',
    inventoryQuantity: extras.inventoryQuantity ?? 1,
  };
}

function thenable(value) {
  return {
    then(resolve, reject) {
      return Promise.resolve(value).then(resolve, reject);
    },
  };
}

function createFakeTx({ lockedArtworks, failAfterReservations = false }) {
  const calls = [];
  const state = {
    locked: false,
    deletedCart: false,
  };
  const inserted = {
    orders: [],
    orderItems: [],
    reservations: [],
  };

  const tx = {
    select() {
      return {
        from() {
          return {
            where() {
              return {
                async for(mode) {
                  calls.push(['lock', mode]);
                  state.locked = true;
                  return lockedArtworks;
                },
              };
            },
          };
        },
      };
    },
    insert(table) {
      return {
        values(values) {
          const name = table?.[Symbol.for('drizzle:Name')] || table?.name || 'unknown';
          const record = { table: name, values };
          if (failAfterReservations && inserted.reservations.length > 0 && name.includes('cart')) {
            return thenable(null);
          }
          if (Array.isArray(values) && values[0]?.artworkTitle !== undefined) {
            inserted.orderItems.push(record);
            calls.push(['insert-order-items']);
            return thenable({ rowCount: values.length });
          }
          if (Array.isArray(values) && values[0]?.expiresAt !== undefined) {
            inserted.reservations.push(record);
            calls.push(['insert-reservations']);
            return thenable({ rowCount: values.length });
          }
          inserted.orders.push(record);
          calls.push(['insert-order']);
          return {
            async returning() {
              return [{
                id: 'order-1',
                orderNumber: 'MDA-TEST',
                userId: 'user-1',
                status: 'pending_payment',
                totalPaise: 250000,
              }];
            },
          };
        },
      };
    },
    delete() {
      return {
        async where() {
          if (failAfterReservations) {
            throw new Error('forced rollback');
          }
          state.deletedCart = true;
          calls.push(['delete-cart']);
        },
      };
    },
  };

  return { tx, calls, state, inserted };
}

async function checkoutWith(items, lockedArtworks, extras = {}) {
  const fake = createFakeTx({ lockedArtworks, failAfterReservations: extras.failAfterReservations });
  const reservedCalls = [];
  const expireCalls = [];
  const sequence = [];

  const run = createCheckoutOrder('user-1', { shippingAddress }, {
    loadCart: async () => ({
      id: 'cart-1',
      items,
      count: items.length,
    }),
    expireReservations: async (executor) => {
      sequence.push('expire');
      expireCalls.push(executor);
    },
    loadReservedQuantities: async (ids, executor) => {
      sequence.push('reserved');
      reservedCalls.push({ ids, executor });
      if (!fake.state.locked) {
        throw new Error('reservation lookup ran before artwork locks');
      }
      return extras.reservedMap || new Map();
    },
    runTransaction: async (callback) => {
      try {
        return await callback(fake.tx);
      } catch (error) {
        fake.state.deletedCart = false;
        fake.inserted.orders.length = 0;
        fake.inserted.orderItems.length = 0;
        fake.inserted.reservations.length = 0;
        throw error;
      }
    },
  });

  return { run, fake, reservedCalls, expireCalls, sequence };
}

test('checkout transaction expires, locks, then batches reserved quantities on the same executor', () => {
  const source = fs.readFileSync(path.join(backendRoot, 'src/services/checkout.service.js'), 'utf8');
  const start = source.indexOf('export async function createCheckoutOrder');
  const end = source.indexOf('export async function getOrderForUser');
  const body = source.slice(start, end);

  assert.match(body, /await expireReservations\(tx\)/);
  assert.match(body, /\.for\('update'\)/);
  assert.match(body, /await loadReservedQuantities\(artworkIds, tx\)/);
  assert.ok(body.indexOf(".for('update')") < body.indexOf('loadReservedQuantities(artworkIds, tx)'));
  assert.ok(body.indexOf('loadReservedQuantities(artworkIds, tx)') < body.indexOf('lineItemsFromLockedArtworks'));
  assert.ok(body.indexOf('insert(orders)') < body.indexOf('delete(cartItems)'));
  assert.doesNotMatch(body, /getActiveReservedQuantity\(/);
});

test('empty cart still returns 400 and never opens a checkout transaction', async () => {
  let transactionStarted = false;
  await assert.rejects(
    () => createCheckoutOrder('user-1', { shippingAddress }, {
      loadCart: async () => ({ id: 'cart-1', items: [], count: 0 }),
      runTransaction: async () => {
        transactionStarted = true;
      },
    }),
    (error) => error instanceof ApiError && error.statusCode === 400 && error.message === 'Cart is empty',
  );
  assert.equal(transactionStarted, false);
});

test('a single locked artwork uses one batched reservation lookup on the transaction', async () => {
  const artwork = publishedArtwork(firstId);
  const { run, fake, reservedCalls, expireCalls, sequence } = await checkoutWith(
    [{ id: 'item-1', artworkId: firstId }],
    [artwork],
  );
  const result = await run;

  assert.equal(reservedCalls.length, 1);
  assert.equal(reservedCalls[0].executor, fake.tx);
  assert.deepEqual(reservedCalls[0].ids, [firstId]);
  assert.deepEqual(sequence, ['expire', 'reserved']);
  assert.equal(expireCalls[0], fake.tx);
  assert.equal(fake.state.deletedCart, true);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].artworkId, firstId);
  assert.equal(result.items[0].artworkTitle, artwork.title);
});

test('multi-item checkout uses exactly one batched reservation lookup', async () => {
  const { run, fake, reservedCalls } = await checkoutWith(
    [
      { id: 'item-1', artworkId: firstId },
      { id: 'item-2', artworkId: secondId },
    ],
    [publishedArtwork(firstId), publishedArtwork(secondId, { title: 'Second' })],
  );
  const result = await run;

  assert.equal(reservedCalls.length, 1);
  assert.equal(reservedCalls[0].executor, fake.tx);
  assert.deepEqual(reservedCalls[0].ids, [firstId, secondId]);
  assert.equal(result.items.length, 2);
  assert.equal(fake.inserted.reservations[0].values.length, 2);
  assert.equal(fake.state.deletedCart, true);
});

test('missing locked artwork still produces the existing 409', () => {
  assert.throws(
    () => lineItemsFromLockedArtworks(
      [publishedArtwork(firstId)],
      [firstId, secondId],
      new Map(),
    ),
    (error) => error instanceof ApiError
      && error.statusCode === 409
      && error.message === 'One or more artworks are no longer available',
  );
});

test('sold, unpublished and oversold locked artworks still return 409', () => {
  const sold = publishedArtwork(firstId, { status: 'sold' });
  const draft = publishedArtwork(firstId, { status: 'draft' });
  const reserved = publishedArtwork(firstId, { inventoryQuantity: 1 });

  for (const artwork of [sold, draft]) {
    assert.throws(
      () => lineItemsFromLockedArtworks([artwork], [firstId], new Map()),
      (error) => error instanceof ApiError && error.statusCode === 409,
    );
  }

  assert.throws(
    () => lineItemsFromLockedArtworks(
      [reserved],
      [firstId],
      new Map([[firstId, 1]]),
    ),
    (error) => error instanceof ApiError
      && error.statusCode === 409
      && error.message.includes('Artwork is not available for purchase'),
  );
});

test('successful checkout writes order and reservation snapshots from locked rows before clearing the cart', async () => {
  const artwork = publishedArtwork(firstId, { title: 'Locked Lotus' });
  const { run, fake } = await checkoutWith(
    [{ id: 'item-1', artworkId: firstId }],
    [artwork],
  );
  await run;

  assert.equal(fake.calls.some((call) => call[0] === 'insert-order'), true);
  assert.ok(fake.calls.findIndex((call) => call[0] === 'insert-reservations')
    < fake.calls.findIndex((call) => call[0] === 'delete-cart'));
  assert.equal(fake.inserted.orderItems[0].values[0].artworkTitle, 'Locked Lotus');
  assert.equal(fake.inserted.orderItems[0].values[0].artworkSnapshot.artistName, 'Artist');
  assert.equal(fake.inserted.reservations[0].values[0].status, 'active');
  assert.equal(fake.state.deletedCart, true);
});

test('transaction rollback preserves the cart and drops partial order writes', async () => {
  const { run, fake } = await checkoutWith(
    [{ id: 'item-1', artworkId: firstId }],
    [publishedArtwork(firstId)],
    { failAfterReservations: true },
  );

  await assert.rejects(run, /forced rollback/);
  assert.equal(fake.state.deletedCart, false);
  assert.equal(fake.inserted.orders.length, 0);
  assert.equal(fake.inserted.reservations.length, 0);
});

test('expireStaleReservations skips payment-authorized holds and expires the rest', async () => {
  const stale = [
    { id: 'res-open', orderId: 'order-open' },
    { id: 'res-auth', orderId: 'order-auth' },
  ];
  const updates = [];
  let selectCalls = 0;
  const executor = {
    select() {
      selectCalls += 1;
      const query = {
        from() { return query; },
        innerJoin() { return query; },
        where() { return query; },
        then(resolve, reject) {
          const rows = selectCalls === 1 ? stale : [{ orderId: 'order-auth' }];
          return Promise.resolve(rows).then(resolve, reject);
        },
      };
      return query;
    },
    update(table) {
      return {
        set(values) {
          return {
            async where() {
              updates.push({ table, values });
            },
          };
        },
      };
    },
  };

  const expired = await expireStaleReservations(executor, new Date('2026-01-01T00:00:00.000Z'));
  assert.deepEqual(expired.map((row) => row.id), ['res-open']);
  assert.equal(updates.length, 2);
  assert.equal(updates[0].values.status, 'expired');
  assert.equal(updates[1].values.status, 'cancelled');
});
