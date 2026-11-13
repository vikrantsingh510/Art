export const firstArtworkId = '11111111-1111-4111-8111-111111111111';
export const secondArtworkId = '22222222-2222-4222-8222-222222222222';

export const shippingAddress = {
  recipientName: 'Collector',
  phone: '+919999999999',
  addressLine1: '1 Atelier Road',
  city: 'Mumbai',
  state: 'MH',
  postalCode: '400001',
  country: 'IN',
};

export function publishedArtwork(id, extras = {}) {
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

export function thenable(value) {
  return {
    then(resolve, reject) {
      return Promise.resolve(value).then(resolve, reject);
    },
  };
}

export function createMutex() {
  let locked = false;
  const waiters = [];

  return {
    get waiting() {
      return waiters.length;
    },
    get held() {
      return locked;
    },
    async acquire() {
      if (!locked) {
        locked = true;
        return;
      }

      await new Promise((resolve) => {
        waiters.push(resolve);
      });
    },
    release() {
      const next = waiters.shift();
      if (next) {
        next();
        return;
      }
      locked = false;
    },
  };
}

export async function waitFor(predicate, label = 'condition', timeoutMs = 1000) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) {
      throw new Error(`timed out waiting for ${label}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

export function createFakeTx({
  lockedArtworks,
  failAfterReservations = false,
  onDeleteCart,
  onInsertReservations,
  artworkMutex,
} = {}) {
  const calls = [];
  const state = {
    locked: false,
    ordered: false,
    deletedCart: false,
    heldArtwork: false,
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
                limit() {
                  return this;
                },
                orderBy() {
                  calls.push(['artwork-order-by']);
                  state.ordered = true;
                  return {
                    async for(mode) {
                      if (artworkMutex) {
                        await artworkMutex.acquire();
                        state.heldArtwork = true;
                      }
                      calls.push(['lock', mode]);
                      state.locked = true;
                      const rows = typeof lockedArtworks === 'function'
                        ? lockedArtworks()
                        : lockedArtworks;
                      return [...rows].sort((left, right) => (
                        left.id < right.id ? -1 : left.id > right.id ? 1 : 0
                      ));
                    },
                  };
                },
                async for() {
                  throw new Error('artwork FOR UPDATE must ORDER BY id');
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
            onInsertReservations?.(values);
            return thenable({ rowCount: values.length });
          }
          inserted.orders.push(record);
          calls.push(['insert-order']);
          return {
            async returning() {
              return [{
                id: `order-${inserted.orders.length}`,
                orderNumber: 'MDA-TEST',
                userId: values.userId || 'user-1',
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
          onDeleteCart?.();
        },
      };
    },
  };

  return { tx, calls, state, inserted };
}
