import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  createCheckoutOrder,
  lineItemsFromLockedArtworks,
  sortedArtworkIds,
} from '../src/services/checkout.service.js';
import { expireStaleReservations } from '../src/services/inventory.service.js';
import { ApiError } from '../src/utils/ApiError.js';
import {
  createFakeTx,
  firstArtworkId as firstId,
  publishedArtwork,
  secondArtworkId as secondId,
  shippingAddress,
} from './helpers/checkout-lock-harness.js';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function checkoutWith(items, lockedArtworks, extras = {}) {
  const fake = createFakeTx({ lockedArtworks, failAfterReservations: extras.failAfterReservations });
  const reservedCalls = [];
  const expireCalls = [];
  const sequence = [];
  const cart = extras.cart || { id: 'cart-1', userId: extras.userId || 'user-1' };

  const run = createCheckoutOrder(extras.userId || 'user-1', { shippingAddress }, {
    lockCart: async (userId, executor) => {
      sequence.push('lock-cart');
      expireCalls.executor = executor;
      if (executor !== fake.tx) {
        throw new Error('cart lock used a different executor than the checkout transaction');
      }
      if (extras.lockCart) {
        return extras.lockCart(userId, executor);
      }
      return cart.userId === userId ? cart : null;
    },
    loadCartItems: async (cartId, executor) => {
      sequence.push('read-items');
      if (executor !== fake.tx) {
        throw new Error('cart re-read used a different executor than the checkout transaction');
      }
      if (cartId !== cart.id) {
        throw new Error('cart re-read used a different cart id');
      }
      return extras.loadCartItems ? extras.loadCartItems(cartId, executor) : items;
    },
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
      if (!fake.state.ordered) {
        throw new Error('reservation lookup ran before sorted artwork locks');
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

test('checkout transaction expires, locks the cart, then batches reserved quantities on the same executor', () => {
  const source = fs.readFileSync(path.join(backendRoot, 'src/services/checkout.service.js'), 'utf8');
  const start = source.indexOf('export async function createCheckoutOrder');
  const end = source.indexOf('export async function getOrderForUser');
  const body = source.slice(start, end);
  const captureStart = source.indexOf('export async function convertReservationsForCapturedPayment');

  assert.match(body, /await expireReservations\(tx\)/);
  assert.match(body, /await lockCart\(userId, tx\)/);
  assert.match(body, /await loadCartItems\(cart\.id, tx\)/);
  assert.match(body, /sortedArtworkIds\(/);
  assert.match(body, /orderBy\(asc\(artworks\.id\)\)/);
  assert.match(body, /\.for\('update'\)/);
  assert.match(body, /await loadReservedQuantities\(artworkIds, tx\)/);
  assert.ok(body.indexOf('expireReservations(tx)') < body.indexOf('lockCart(userId, tx)'));
  assert.ok(body.indexOf('lockCart(userId, tx)') < body.indexOf('loadCartItems(cart.id, tx)'));
  assert.ok(body.indexOf('loadCartItems(cart.id, tx)') < body.indexOf('sortedArtworkIds'));
  assert.ok(body.indexOf("orderBy(asc(artworks.id))") < body.indexOf(".for('update')"));
  assert.ok(body.indexOf(".for('update')") < body.indexOf('loadReservedQuantities(artworkIds, tx)'));
  assert.ok(body.indexOf('loadReservedQuantities(artworkIds, tx)') < body.indexOf('lineItemsFromLockedArtworks'));
  assert.ok(body.indexOf('insert(orders)') < body.indexOf('delete(cartItems)'));
  assert.doesNotMatch(body, /getActiveReservedQuantity\(/);
  assert.doesNotMatch(body, /loadCart\(/);
  assert.doesNotMatch(body, /idempotency/i);
  assert.doesNotMatch(source.slice(captureStart), /carts|cartItems|lockCart/);
});

test('sortedArtworkIds is lexicographic and independent of input order', () => {
  assert.deepEqual(sortedArtworkIds([secondId, firstId]), [firstId, secondId]);
  assert.deepEqual(sortedArtworkIds([firstId, secondId]), [firstId, secondId]);
});

test('empty cart after cart lock returns 400 and does not create an order', async () => {
  const { run, fake, sequence } = await checkoutWith([], [publishedArtwork(firstId)]);

  await assert.rejects(
    run,
    (error) => error instanceof ApiError && error.statusCode === 400 && error.message === 'Cart is empty',
  );
  assert.deepEqual(sequence, ['expire', 'lock-cart', 'read-items']);
  assert.equal(fake.inserted.orders.length, 0);
  assert.equal(fake.inserted.reservations.length, 0);
  assert.equal(fake.state.deletedCart, false);
  assert.equal(fake.state.locked, false);
});

test('missing cart after lock returns 400 Cart is empty', async () => {
  const { run, fake } = await checkoutWith(
    [{ id: 'item-1', artworkId: firstId }],
    [publishedArtwork(firstId)],
    { cart: { id: 'cart-1', userId: 'someone-else' } },
  );

  await assert.rejects(
    run,
    (error) => error instanceof ApiError && error.statusCode === 400 && error.message === 'Cart is empty',
  );
  assert.equal(fake.inserted.orders.length, 0);
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
  assert.deepEqual(sequence, ['expire', 'lock-cart', 'read-items', 'reserved']);
  assert.equal(expireCalls[0], fake.tx);
  assert.equal(fake.state.deletedCart, true);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].artworkId, firstId);
  assert.equal(result.items[0].artworkTitle, artwork.title);
});

test('multi-item checkout uses exactly one batched reservation lookup of sorted IDs', async () => {
  const { run, fake, reservedCalls } = await checkoutWith(
    [
      { id: 'item-2', artworkId: secondId },
      { id: 'item-1', artworkId: firstId },
    ],
    [publishedArtwork(secondId, { title: 'Second' }), publishedArtwork(firstId)],
  );
  const result = await run;

  assert.equal(reservedCalls.length, 1);
  assert.equal(reservedCalls[0].executor, fake.tx);
  assert.deepEqual(reservedCalls[0].ids, [firstId, secondId]);
  assert.equal(result.items.length, 2);
  assert.equal(result.items[0].artworkId, firstId);
  assert.equal(result.items[1].artworkId, secondId);
  assert.equal(fake.inserted.reservations[0].values.length, 2);
  assert.equal(fake.state.deletedCart, true);
  assert.ok(fake.calls.findIndex((call) => call[0] === 'artwork-order-by')
    < fake.calls.findIndex((call) => call[0] === 'lock'));
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
