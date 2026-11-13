import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { addCartItem, removeCartItem } from '../src/services/cart.service.js';
import { createCheckoutOrder } from '../src/services/checkout.service.js';
import { moveWishlistItemToCart } from '../src/services/wishlist.service.js';
import { ApiError } from '../src/utils/ApiError.js';
import {
  createFakeTx,
  createMutex,
  firstArtworkId,
  publishedArtwork,
  secondArtworkId,
  shippingAddress,
  waitFor,
} from './helpers/checkout-lock-harness.js';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function createMutationTx({
  items,
  artworkId,
  events,
  requestId,
}) {
  return {
    insert() {
      return {
        values(values) {
          events.push([requestId, 'insert-item', values.artworkId]);
          return {
            onConflictDoNothing() {
              return {
                async returning() {
                  if (items.some((item) => item.artworkId === values.artworkId)) {
                    return [];
                  }
                  const created = {
                    id: `item-${values.artworkId}`,
                    cartId: values.cartId,
                    artworkId: values.artworkId,
                  };
                  items.push(created);
                  return [created];
                },
              };
            },
          };
        },
      };
    },
    select() {
      return {
        from() {
          return {
            where() {
              return {
                async limit() {
                  return items.filter((item) => item.artworkId === artworkId);
                },
              };
            },
          };
        },
      };
    },
    delete() {
      return {
        where() {
          events.push([requestId, 'delete-item', artworkId]);
          return {
            async returning() {
              const index = items.findIndex((item) => item.artworkId === artworkId);
              if (index < 0) {
                return [];
              }
              return items.splice(index, 1);
            },
          };
        },
      };
    },
  };
}

function createCartWorld({
  userId = 'user-1',
  cartId = 'cart-1',
  items,
  artworks,
  cartMutex = createMutex(),
  artworkMutex = createMutex(),
  reserved = new Map(),
  events = [],
  orders = [],
} = {}) {
  const currentItems = items.map((item) => ({ ...item }));
  const itemReads = [];

  function checkoutDeps(requestId, extras = {}) {
    let heldCart = false;
    const fake = createFakeTx({
      lockedArtworks: () => artworks.filter((artwork) => (
        currentItems.some((item) => item.artworkId === artwork.id)
      )),
      artworkMutex,
      failAfterReservations: extras.failAfterReservations,
      onDeleteCart: () => {
        currentItems.splice(0, currentItems.length);
        events.push([requestId, 'delete-cart']);
      },
    });

    return {
      fake,
      deps: {
        lockCart: async (uid, executor) => {
          if (executor !== fake.tx) {
            throw new Error('cart lock used a different executor than the checkout transaction');
          }
          events.push([requestId, 'lock-wait']);
          await cartMutex.acquire();
          heldCart = true;
          events.push([requestId, 'lock-acquired']);
          if (extras.afterLock) {
            await extras.afterLock();
          }
          return { id: cartId, userId: uid };
        },
        loadCartItems: async (id, executor) => {
          if (executor !== fake.tx) {
            throw new Error('cart re-read used a different executor than the checkout transaction');
          }
          const snapshot = currentItems.map((item) => ({ ...item }));
          itemReads.push({ requestId, cartId: id, items: snapshot });
          events.push([requestId, 'read-items', snapshot.map((item) => item.artworkId)]);
          if (extras.afterRead) {
            await extras.afterRead();
          }
          return snapshot;
        },
        expireReservations: async (executor) => {
          if (executor !== fake.tx) {
            throw new Error('expiry used a different executor than the checkout transaction');
          }
          events.push([requestId, 'expire']);
        },
        loadReservedQuantities: async (ids, executor) => {
          if (executor !== fake.tx) {
            throw new Error('reservation lookup used a different executor than the checkout transaction');
          }
          if (!fake.state.locked) {
            throw new Error('reservation lookup ran before artwork locks');
          }
          events.push([requestId, 'reserved', ids]);
          if (extras.afterReserved) {
            await extras.afterReserved();
          }
          return new Map(ids.map((id) => [id, reserved.get(id) || 0]));
        },
        runTransaction: async (callback) => {
          try {
            const result = await callback(fake.tx);
            for (const record of fake.inserted.reservations) {
              for (const row of record.values) {
                reserved.set(row.artworkId, (reserved.get(row.artworkId) || 0) + row.quantity);
              }
            }
            if (result?.id) {
              orders.push(result);
            }
            return result;
          } catch (error) {
            fake.state.deletedCart = false;
            fake.inserted.orders.length = 0;
            fake.inserted.orderItems.length = 0;
            fake.inserted.reservations.length = 0;
            throw error;
          } finally {
            if (fake.state.heldArtwork) {
              artworkMutex.release();
            }
            if (heldCart) {
              cartMutex.release();
            }
          }
        },
      },
    };
  }

  function mutationDeps(requestId, artworkId, extras = {}) {
    let heldCart = false;
    const tx = createMutationTx({
      items: currentItems,
      artworkId,
      events,
      requestId,
    });

    return {
      loadArtwork: async () => ({ isPurchasable: true }),
      lockCart: async (uid, executor) => {
        if (executor !== tx) {
          throw new Error('cart mutation lock used a different executor than its transaction');
        }
        events.push([requestId, 'lock-wait']);
        await cartMutex.acquire();
        heldCart = true;
        events.push([requestId, 'lock-acquired']);
        if (extras.afterLock) {
          await extras.afterLock();
        }
        return { id: cartId, userId: uid };
      },
      runTransaction: async (callback) => {
        try {
          return await callback(tx);
        } finally {
          if (heldCart) {
            cartMutex.release();
          }
        }
      },
    };
  }

  return {
    userId,
    cartId,
    cartMutex,
    events,
    orders,
    itemReads,
    reserved,
    items: currentItems,
    checkoutDeps,
    mutationDeps,
  };
}

test('A: two simultaneous checkouts of the same cart serialize on the cart lock', async () => {
  const artwork = publishedArtwork(firstArtworkId, { inventoryQuantity: 2 });
  const world = createCartWorld({
    items: [{ id: 'item-a', artworkId: firstArtworkId }],
    artworks: [artwork],
  });

  let resumeFirst;
  const holdFirst = new Promise((resolve) => {
    resumeFirst = resolve;
  });
  const first = createCheckoutOrder(
    world.userId,
    { shippingAddress },
    world.checkoutDeps('r1', { afterLock: () => holdFirst }).deps,
  );
  await waitFor(() => world.events.some((event) => event[0] === 'r1' && event[1] === 'lock-acquired'), 'first cart lock');

  const second = createCheckoutOrder(world.userId, { shippingAddress }, world.checkoutDeps('r2').deps);
  await waitFor(() => world.cartMutex.waiting === 1, 'second checkout waiting on cart lock');
  resumeFirst();

  const winner = await first;
  await assert.rejects(
    second,
    (error) => error instanceof ApiError && error.statusCode === 400 && error.message === 'Cart is empty',
  );

  assert.equal(winner.items.length, 1);
  assert.equal(world.orders.length, 1);
  assert.equal(world.reserved.get(firstArtworkId), 1);
  assert.equal(world.items.length, 0);
  assert.deepEqual(world.itemReads[0].items.map((item) => item.artworkId), [firstArtworkId]);
  assert.deepEqual(world.itemReads[1].items, []);
  assert.ok(world.events.findIndex((event) => event[0] === 'r2' && event[1] === 'lock-acquired')
    > world.events.findIndex((event) => event[0] === 'r1' && event[1] === 'delete-cart'));
});

test('H: two devices for the same customer reuse the same cart-lock serialization', async () => {
  const artwork = publishedArtwork(firstArtworkId, { inventoryQuantity: 2 });
  const world = createCartWorld({
    items: [{ id: 'item-a', artworkId: firstArtworkId }],
    artworks: [artwork],
  });

  let resumeFirst;
  const holdFirst = new Promise((resolve) => {
    resumeFirst = resolve;
  });
  const deviceOne = createCheckoutOrder(
    world.userId,
    { shippingAddress },
    world.checkoutDeps('device-1', { afterLock: () => holdFirst }).deps,
  );
  await waitFor(() => world.events.some((event) => event[0] === 'device-1' && event[1] === 'lock-acquired'), 'device-1 lock');
  const deviceTwo = createCheckoutOrder(world.userId, { shippingAddress }, world.checkoutDeps('device-2').deps);
  await waitFor(() => world.cartMutex.waiting === 1, 'device-2 waiting');
  resumeFirst();

  await deviceOne;
  await assert.rejects(
    deviceTwo,
    (error) => error instanceof ApiError && error.statusCode === 400 && error.message === 'Cart is empty',
  );
  assert.equal(world.orders.length, 1);
  assert.equal(world.items.length, 0);
  assert.equal(world.itemReads[1].requestId, 'device-2');
  assert.deepEqual(world.itemReads[1].items, []);
});

test('B: add during checkout waits, then keeps the new item after checkout commits', async () => {
  const artworkA = publishedArtwork(firstArtworkId);
  const world = createCartWorld({
    items: [{ id: 'item-a', artworkId: firstArtworkId }],
    artworks: [artworkA],
  });

  let resumeCheckout;
  const holdCheckout = new Promise((resolve) => {
    resumeCheckout = resolve;
  });
  const checkout = createCheckoutOrder(
    world.userId,
    { shippingAddress },
    world.checkoutDeps('checkout', { afterRead: () => holdCheckout }).deps,
  );
  await waitFor(() => world.events.some((event) => event[0] === 'checkout' && event[1] === 'read-items'), 'checkout snapshot');

  const add = addCartItem(world.userId, secondArtworkId, world.mutationDeps('add', secondArtworkId));
  await waitFor(() => world.cartMutex.waiting === 1, 'add waiting on cart lock');
  resumeCheckout();

  const order = await checkout;
  const added = await add;

  assert.deepEqual(order.items.map((item) => item.artworkId), [firstArtworkId]);
  assert.equal(added.artworkId, secondArtworkId);
  assert.deepEqual(world.items.map((item) => item.artworkId), [secondArtworkId]);
  assert.ok(world.events.findIndex((event) => event[0] === 'add' && event[1] === 'lock-acquired')
    > world.events.findIndex((event) => event[0] === 'checkout' && event[1] === 'delete-cart'));
  assert.ok(world.events.findIndex((event) => event[0] === 'add' && event[1] === 'insert-item')
    > world.events.findIndex((event) => event[0] === 'add' && event[1] === 'lock-acquired'));
});

test('C: remove that wins the cart lock is visible to the waiting checkout re-read', async () => {
  const artworks = [
    publishedArtwork(firstArtworkId),
    publishedArtwork(secondArtworkId, { title: 'Second' }),
  ];
  const world = createCartWorld({
    items: [
      { id: 'item-a', artworkId: firstArtworkId },
      { id: 'item-b', artworkId: secondArtworkId },
    ],
    artworks,
  });

  let resumeRemove;
  const holdRemove = new Promise((resolve) => {
    resumeRemove = resolve;
  });
  const remove = removeCartItem(
    world.userId,
    secondArtworkId,
    world.mutationDeps('remove', secondArtworkId, { afterLock: () => holdRemove }),
  );
  await waitFor(() => world.events.some((event) => event[0] === 'remove' && event[1] === 'lock-acquired'), 'remove lock');

  const checkout = createCheckoutOrder(world.userId, { shippingAddress }, world.checkoutDeps('checkout').deps);
  await waitFor(() => world.cartMutex.waiting === 1, 'checkout waiting on remove');
  resumeRemove();

  await remove;
  const order = await checkout;

  assert.deepEqual(order.items.map((item) => item.artworkId), [firstArtworkId]);
  assert.equal(world.reserved.get(secondArtworkId), undefined);
  assert.equal(world.items.length, 0);
  assert.deepEqual(world.itemReads[0].items.map((item) => item.artworkId), [firstArtworkId]);
});

test('D: checkout that wins the lock orders both items; later remove sees the empty cart', async () => {
  const artworks = [
    publishedArtwork(firstArtworkId),
    publishedArtwork(secondArtworkId, { title: 'Second' }),
  ];
  const world = createCartWorld({
    items: [
      { id: 'item-a', artworkId: firstArtworkId },
      { id: 'item-b', artworkId: secondArtworkId },
    ],
    artworks,
  });

  let resumeCheckout;
  const holdCheckout = new Promise((resolve) => {
    resumeCheckout = resolve;
  });
  const checkout = createCheckoutOrder(
    world.userId,
    { shippingAddress },
    world.checkoutDeps('checkout', { afterRead: () => holdCheckout }).deps,
  );
  await waitFor(() => world.events.some((event) => event[0] === 'checkout' && event[1] === 'read-items'), 'checkout snapshot');

  const remove = removeCartItem(world.userId, secondArtworkId, world.mutationDeps('remove', secondArtworkId));
  await waitFor(() => world.cartMutex.waiting === 1, 'remove waiting on checkout');
  resumeCheckout();

  const order = await checkout;
  await assert.rejects(
    remove,
    (error) => error instanceof ApiError && error.statusCode === 404 && error.message === 'Cart item not found',
  );

  assert.deepEqual(order.items.map((item) => item.artworkId), [firstArtworkId, secondArtworkId]);
  assert.equal(world.reserved.get(firstArtworkId), 1);
  assert.equal(world.reserved.get(secondArtworkId), 1);
  assert.equal(world.items.length, 0);
});

test('E: two customers competing for the last unit keep artwork locks and P24-A batching', async () => {
  const artwork = publishedArtwork(firstArtworkId, { inventoryQuantity: 1 });
  const artworkMutex = createMutex();
  const reserved = new Map();
  const events = [];
  const orders = [];
  const customerOne = createCartWorld({
    userId: 'user-1',
    cartId: 'cart-1',
    items: [{ id: 'item-1', artworkId: firstArtworkId }],
    artworks: [artwork],
    artworkMutex,
    reserved,
    events,
    orders,
  });
  const customerTwo = createCartWorld({
    userId: 'user-2',
    cartId: 'cart-2',
    items: [{ id: 'item-2', artworkId: firstArtworkId }],
    artworks: [artwork],
    artworkMutex,
    reserved,
    events,
    orders,
  });

  let resumeFirst;
  const holdFirst = new Promise((resolve) => {
    resumeFirst = resolve;
  });
  const first = createCheckoutOrder(
    'user-1',
    { shippingAddress },
    customerOne.checkoutDeps('c1', { afterReserved: () => holdFirst }).deps,
  );
  await waitFor(() => events.some((event) => event[0] === 'c1' && event[1] === 'reserved'), 'customer 1 artwork lock');

  const second = createCheckoutOrder('user-2', { shippingAddress }, customerTwo.checkoutDeps('c2').deps);
  await waitFor(() => artworkMutex.waiting === 1, 'customer 2 waiting on artwork lock');
  resumeFirst();

  await first;
  await assert.rejects(
    second,
    (error) => error instanceof ApiError
      && error.statusCode === 409
      && error.message.includes('Artwork is not available for purchase'),
  );

  assert.equal(orders.length, 1);
  assert.equal(reserved.get(firstArtworkId), 1);
  assert.equal(customerOne.items.length, 0);
  assert.deepEqual(customerTwo.items.map((item) => item.artworkId), [firstArtworkId]);
  assert.equal(events.filter((event) => event[1] === 'reserved').length, 2);
});

test('F: failure after reservations rolls back writes and preserves cart items', async () => {
  const world = createCartWorld({
    items: [{ id: 'item-a', artworkId: firstArtworkId }],
    artworks: [publishedArtwork(firstArtworkId)],
  });

  await assert.rejects(
    createCheckoutOrder(world.userId, { shippingAddress }, world.checkoutDeps('checkout', {
      failAfterReservations: true,
    }).deps),
    /forced rollback/,
  );

  assert.equal(world.orders.length, 0);
  assert.deepEqual(world.items.map((item) => item.artworkId), [firstArtworkId]);
});

test('G: empty cart after an earlier checkout returns 400 with no writes', async () => {
  const world = createCartWorld({
    items: [],
    artworks: [publishedArtwork(firstArtworkId)],
  });

  await assert.rejects(
    createCheckoutOrder(world.userId, { shippingAddress }, world.checkoutDeps('checkout').deps),
    (error) => error instanceof ApiError && error.statusCode === 400 && error.message === 'Cart is empty',
  );
  assert.equal(world.orders.length, 0);
  assert.equal(world.reserved.size, 0);
  assert.ok(!world.events.some((event) => event[1] === 'reserved'));
});

test('I: artwork lock query uses deterministically sorted IDs after the cart re-read', async () => {
  const world = createCartWorld({
    items: [
      { id: 'item-b', artworkId: secondArtworkId },
      { id: 'item-a', artworkId: firstArtworkId },
    ],
    artworks: [
      publishedArtwork(secondArtworkId, { title: 'Second' }),
      publishedArtwork(firstArtworkId),
    ],
  });
  const { fake, deps } = world.checkoutDeps('checkout');
  const order = await createCheckoutOrder(world.userId, { shippingAddress }, deps);

  assert.deepEqual(order.items.map((item) => item.artworkId), [firstArtworkId, secondArtworkId]);
  const reservedEvent = world.events.find((event) => event[1] === 'reserved');
  assert.deepEqual(reservedEvent[2], [firstArtworkId, secondArtworkId]);
  assert.ok(fake.calls.findIndex((call) => call[0] === 'artwork-order-by')
    < fake.calls.findIndex((call) => call[0] === 'lock'));
  assert.ok(world.events.findIndex((event) => event[1] === 'read-items')
    < world.events.findIndex((event) => event[1] === 'reserved'));
});

test('J: add and remove lock the cart row on the mutation transaction and never lock artworks', async () => {
  const source = fs.readFileSync(path.join(backendRoot, 'src/services/cart.service.js'), 'utf8');
  const addBody = source.slice(
    source.indexOf('export async function addCartItem'),
    source.indexOf('export async function removeCartItem'),
  );
  const removeBody = source.slice(source.indexOf('export async function removeCartItem'));

  assert.match(addBody, /await lockCart\(userId, tx\)/);
  assert.ok(addBody.indexOf('lockCart(userId, tx)') < addBody.indexOf('insert(cartItems)'));
  assert.doesNotMatch(addBody, /artworks/);
  assert.doesNotMatch(addBody, /\.for\('update'\)/);
  assert.match(removeBody, /await lockCart\(userId, tx\)/);
  assert.ok(removeBody.indexOf('lockCart(userId, tx)') < removeBody.indexOf('delete(cartItems)'));
  assert.doesNotMatch(removeBody, /artworks/);
  assert.doesNotMatch(removeBody, /\.for\('update'\)/);
  assert.match(source, /lockCartForUser[\s\S]*\.for\('update'\)/);

  const world = createCartWorld({
    items: [{ id: 'item-a', artworkId: firstArtworkId }],
    artworks: [publishedArtwork(firstArtworkId)],
  });

  const added = await addCartItem(world.userId, secondArtworkId, world.mutationDeps('add', secondArtworkId));
  assert.equal(added.artworkId, secondArtworkId);
  assert.ok(world.events.findIndex((event) => event[0] === 'add' && event[1] === 'lock-acquired')
    < world.events.findIndex((event) => event[0] === 'add' && event[1] === 'insert-item'));

  const duplicate = await addCartItem(world.userId, secondArtworkId, world.mutationDeps('dup', secondArtworkId));
  assert.equal(duplicate.artworkId, secondArtworkId);
  assert.equal(world.items.filter((item) => item.artworkId === secondArtworkId).length, 1);

  const removed = await removeCartItem(world.userId, secondArtworkId, world.mutationDeps('remove', secondArtworkId));
  assert.equal(removed.artworkId, secondArtworkId);
  assert.ok(world.events.findIndex((event) => event[0] === 'remove' && event[1] === 'lock-acquired')
    < world.events.findIndex((event) => event[0] === 'remove' && event[1] === 'delete-item'));
});

test('K: wishlist move-to-cart reuses locked addCartItem and cannot insert cart rows itself', () => {
  const source = fs.readFileSync(path.join(backendRoot, 'src/services/wishlist.service.js'), 'utf8');
  const body = source.slice(
    source.indexOf('export async function moveWishlistItemToCart'),
    source.indexOf('export default'),
  );

  assert.match(body, /addToCart = addCartItem/);
  assert.match(body, /await addToCart\(userId, artworkId\)/);
  assert.doesNotMatch(body, /insert\(cartItems\)/);
  assert.doesNotMatch(body, /lockCartForUser|lockOrCreateCartForUser|\.for\('update'\)/);
  assert.equal(typeof moveWishlistItemToCart, 'function');
});

test('L: expiry still runs before the cart lock and P24-A reserved lookup stays after artwork locks', async () => {
  const world = createCartWorld({
    items: [{ id: 'item-a', artworkId: firstArtworkId }],
    artworks: [publishedArtwork(firstArtworkId)],
  });
  await createCheckoutOrder(world.userId, { shippingAddress }, world.checkoutDeps('checkout').deps);

  const sequence = world.events.filter((event) => event[0] === 'checkout').map((event) => event[1]);
  assert.deepEqual(sequence.slice(0, 5), ['expire', 'lock-wait', 'lock-acquired', 'read-items', 'reserved']);

  const checkoutSource = fs.readFileSync(path.join(backendRoot, 'src/services/checkout.service.js'), 'utf8');
  const inventorySource = fs.readFileSync(path.join(backendRoot, 'src/services/inventory.service.js'), 'utf8');
  assert.match(inventorySource, /UNRESOLVED_PAYMENT_STATUSES = \['authorized'\]/);
  assert.match(checkoutSource, /await loadReservedQuantities\(artworkIds, tx\)/);
  assert.doesNotMatch(checkoutSource, /getActiveReservedQuantity\(/);
});
