import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, afterEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { resetAuthDependencies, setAuthDependencies } from '../src/middlewares/auth.middleware.js';
import { ARTWORK_DELETE_BLOCKED_MESSAGE } from '../src/lib/artwork-owned-paths.js';
import { archiveArtwork, deleteArtworkPermanently } from '../src/services/artwork.service.js';
import { cleanupArtworkStorage } from '../src/services/artwork-storage-cleanup.js';
import { isForeignKeyViolation } from '../src/utils/pg-error.js';
import { ApiError } from '../src/utils/ApiError.js';
import { api, stopTestServer } from './helpers/http.js';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artworkId = '11111111-1111-4111-8111-111111111111';
const artistId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const customerId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function tableName(table) {
  return table?.[Symbol.for('drizzle:Name')] || table?.name || '';
}

function createDeleteHarness({
  artwork = {
    id: artworkId,
    title: 'Lotus study',
    slug: 'lotus-study',
    status: 'draft',
    artistId,
  },
  orderCount = 0,
  reservationCount = 0,
  images = [{ storagePath: `${artworkId}/hero.jpg` }],
  media = [{ storageBucket: 'artwork-documents', storagePath: `${artworkId}/cert.pdf` }],
  previews = [{ storagePath: `${artworkId}/room.jpg` }],
  failOnDelete = false,
  failOnAudit = false,
  throwFk = false,
} = {}) {
  const calls = [];
  const audits = [];
  const deletedTables = [];
  const state = {
    artwork: artwork ? { ...artwork } : null,
    deletedArtwork: false,
    committed: false,
  };

  function query(table) {
    const name = tableName(table);
    const chain = {
      where() { return chain; },
      limit() { return chain; },
      async for(mode) {
        calls.push(['lock', name, mode]);
        return state.artwork ? [state.artwork] : [];
      },
      then(resolve, reject) {
        let rows = [];
        if (name === 'order_items') {
          rows = [{ value: orderCount }];
        } else if (name === 'inventory_reservations') {
          rows = [{ value: reservationCount }];
        } else if (name === 'artwork_images') {
          rows = images;
        } else if (name === 'artwork_media') {
          rows = media;
        } else if (name === 'artwork_previews') {
          rows = previews;
        }
        return Promise.resolve(rows).then(resolve, reject);
      },
    };
    return chain;
  }

  const tx = {
    select() {
      return {
        from(table) {
          return query(table);
        },
      };
    },
    delete(table) {
      return {
        async where() {
          const name = tableName(table);
          deletedTables.push(name);
          if (name === 'artists') {
            throw new Error('artist rows must not be deleted');
          }
          if (name === 'order_items' || name === 'inventory_reservations' || name === 'orders') {
            throw new Error('commerce history must not be deleted');
          }
          if (failOnDelete) {
            throw new Error('forced rollback');
          }
          if (throwFk) {
            const error = new Error('foreign key');
            error.code = '23503';
            throw error;
          }
          if (name === 'artworks') {
            state.deletedArtwork = true;
            state.artwork = null;
          }
        },
      };
    },
    insert(table) {
      return {
        async values(values) {
          if (failOnAudit) {
            throw new Error('audit failed');
          }
          audits.push({ table: tableName(table), values });
          calls.push(['audit', values.action]);
        },
      };
    },
  };

  return {
    calls,
    audits,
    deletedTables,
    state,
    tx,
    async runTransaction(callback) {
      try {
        const result = await callback(tx);
        state.committed = true;
        return result;
      } catch (error) {
        state.committed = false;
        state.deletedArtwork = false;
        state.artwork = artwork ? { ...artwork } : null;
        audits.length = 0;
        throw error;
      }
    },
  };
}

async function runDelete(harness, extras = {}) {
  return deleteArtworkPermanently(artworkId, 'admin-1', {
    runTransaction: harness.runTransaction,
    cleanupStorage: extras.cleanupStorage || (async () => {
      extras.cleanupCalls?.push({
        afterCommit: harness.state.committed,
        deleted: harness.state.deletedArtwork,
      });
      return { warnings: extras.cleanupWarnings || [] };
    }),
    writeAudit: extras.writeAudit,
  });
}

test('eligible artwork is permanently deleted', async () => {
  const harness = createDeleteHarness();
  const cleanupCalls = [];
  const result = await runDelete(harness, { cleanupCalls });

  assert.deepEqual(result, { id: artworkId, deleted: true });
  assert.equal(harness.state.deletedArtwork, true);
  assert.equal(harness.state.committed, true);
  assert.deepEqual(harness.deletedTables, ['artworks']);
  assert.equal(harness.audits[0].values.action, 'artwork.delete');
  assert.equal(cleanupCalls[0].afterCommit, true);
});

test('missing artwork returns 404', async () => {
  const harness = createDeleteHarness({ artwork: null });
  await assert.rejects(
    () => runDelete(harness),
    (error) => error instanceof ApiError && error.statusCode === 404 && error.message === 'Artwork not found',
  );
  assert.equal(harness.state.deletedArtwork, false);
  assert.equal(harness.audits.length, 0);
});

test('existing order_items blocks deletion with 409', async () => {
  const harness = createDeleteHarness({ orderCount: 1 });
  await assert.rejects(
    () => runDelete(harness),
    (error) => error instanceof ApiError
      && error.statusCode === 409
      && error.message === ARTWORK_DELETE_BLOCKED_MESSAGE,
  );
  assert.equal(harness.state.deletedArtwork, false);
  assert.equal(harness.audits.length, 0);
});

test('any reservation status blocks deletion with 409', async () => {
  const harness = createDeleteHarness({ reservationCount: 2 });
  await assert.rejects(
    () => runDelete(harness),
    (error) => error instanceof ApiError && error.statusCode === 409,
  );
  assert.equal(harness.state.deletedArtwork, false);
});

test('cart, wishlist, membership, image, media and preview children cascade via schema only', () => {
  const schemas = [
    'cart-items.schema.js',
    'wishlist-items.schema.js',
    'artwork-categories.schema.js',
    'collection-artworks.schema.js',
    'blog-artworks.schema.js',
    'artwork-images.schema.js',
    'artwork-media.schema.js',
    'artwork-previews.schema.js',
  ];
  for (const file of schemas) {
    const source = fs.readFileSync(path.join(backendRoot, 'src/db/schema', file), 'utf8');
    assert.match(source, /onDelete: 'cascade'/);
  }
  const orders = fs.readFileSync(path.join(backendRoot, 'src/db/schema/order-items.schema.js'), 'utf8');
  const reservations = fs.readFileSync(path.join(backendRoot, 'src/db/schema/inventory-reservations.schema.js'), 'utf8');
  assert.match(orders, /onDelete: 'restrict'/);
  assert.match(reservations, /onDelete: 'restrict'/);
});

test('artist record remains unchanged', async () => {
  const harness = createDeleteHarness();
  await runDelete(harness);
  assert.equal(harness.deletedTables.includes('artists'), false);
  assert.equal(harness.deletedTables.includes('artworks'), true);
});

test('archiveArtwork still only updates status', () => {
  const source = fs.readFileSync(path.join(backendRoot, 'src/services/artwork.service.js'), 'utf8');
  const archive = source.slice(
    source.indexOf('export async function archiveArtwork'),
    source.indexOf('export async function deleteArtworkPermanently'),
  );
  assert.match(archive, /status: 'archived'/);
  assert.doesNotMatch(archive, /delete\(artworks\)/);
  assert.equal(typeof archiveArtwork, 'function');
});

test('PostgreSQL 23503 maps to 409', async () => {
  assert.equal(isForeignKeyViolation({ code: '23503' }), true);
  const harness = createDeleteHarness({ throwFk: true });
  await assert.rejects(
    () => runDelete(harness),
    (error) => error instanceof ApiError && error.statusCode === 409 && error.message === ARTWORK_DELETE_BLOCKED_MESSAGE,
  );
  assert.equal(harness.state.deletedArtwork, false);
});

test('transaction rollback preserves artwork and skips audit', async () => {
  const harness = createDeleteHarness({ failOnDelete: true });
  await assert.rejects(() => runDelete(harness), /forced rollback/);
  assert.equal(harness.state.deletedArtwork, false);
  assert.equal(harness.state.artwork?.id, artworkId);
  assert.equal(harness.audits.length, 0);
});

test('audit log is written only on a successful transaction', async () => {
  const failed = createDeleteHarness({ failOnAudit: true });
  await assert.rejects(() => runDelete(failed), /audit failed/);
  assert.equal(failed.audits.length, 0);
  assert.equal(failed.state.deletedArtwork, false);

  const ok = createDeleteHarness();
  await runDelete(ok);
  assert.equal(ok.audits.length, 1);
  assert.equal(ok.audits[0].values.entityType, 'artwork');
  assert.deepEqual(ok.audits[0].values.metadata, {
    title: 'Lotus study',
    slug: 'lotus-study',
    status: 'draft',
  });
});

test('storage cleanup starts only after DB commit', async () => {
  const blocked = createDeleteHarness({ orderCount: 1 });
  const cleanupCalls = [];
  await assert.rejects(() => runDelete(blocked, { cleanupCalls }));
  assert.equal(cleanupCalls.length, 0);

  const eligible = createDeleteHarness();
  await runDelete(eligible, { cleanupCalls });
  assert.equal(cleanupCalls.length, 1);
  assert.equal(cleanupCalls[0].afterCommit, true);
  assert.equal(cleanupCalls[0].deleted, true);
});

test('storage cleanup failure does not reverse DB deletion', async () => {
  const harness = createDeleteHarness();
  const result = await deleteArtworkPermanently(artworkId, 'admin-1', {
    runTransaction: harness.runTransaction,
    cleanupStorage: async () => {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY leaked');
    },
  });
  assert.equal(result.deleted, true);
  assert.deepEqual(result.storageWarnings, ['Storage cleanup skipped.']);
  assert.equal(String(result.storageWarnings).includes('SUPABASE_SERVICE_ROLE_KEY'), false);
  assert.equal(harness.state.deletedArtwork, true);
});

test('AR cleanup skips safely when trusted credentials are unavailable', async () => {
  const result = await cleanupArtworkStorage({
    artworkId,
    images: [{ storagePath: `${artworkId}/hero.jpg` }],
    getCredentials: () => null,
    createStorage: () => {
      throw new Error('must not create a Storage client');
    },
  });
  assert.match(result.warnings[0], /trusted Storage credentials are unavailable/);
});

test('cleanup never deletes another artwork prefix', async () => {
  const removed = [];
  await cleanupArtworkStorage({
    artworkId,
    images: [
      { storagePath: `${artworkId}/hero.jpg` },
      { storagePath: '22222222-2222-4222-8222-222222222222/other.jpg' },
    ],
    media: [{ storageBucket: 'artwork-documents', storagePath: 'artists/portrait.jpg' }],
    previews: [{ storagePath: '../escape.jpg' }],
    getCredentials: () => ({ supabaseUrl: 'https://example.supabase.co', serviceRoleKey: 'sb_secret_test' }),
    createStorage: ({ bucket }) => ({
      bucket,
      async list() { return ['22222222-2222-4222-8222-222222222222/stolen.jpg']; },
      async remove(objectPath) { removed.push(`${bucket}:${objectPath}`); },
    }),
  });
  assert.ok(removed.includes(`artwork-images:${artworkId}/hero.jpg`));
  assert.ok(removed.includes(`artwork-images:${artworkId}/hero.jpg.display.webp`));
  assert.equal(removed.some((item) => item.includes('22222222')), false);
  assert.equal(removed.some((item) => item.includes('artists/')), false);
  assert.equal(removed.some((item) => item.includes('..')), false);
});

test('existing checkout and reservation protections remain unchanged', () => {
  const checkout = fs.readFileSync(path.join(backendRoot, 'src/services/checkout.service.js'), 'utf8');
  assert.match(checkout, /await lockCart\(userId, tx\)/);
  assert.match(checkout, /loadReservedQuantities\(artworkIds, tx\)/);
  assert.match(checkout, /orderBy\(asc\(artworks\.id\)\)/);
  assert.doesNotMatch(checkout, /deleteArtworkPermanently/);
  const inventory = fs.readFileSync(path.join(backendRoot, 'src/services/inventory.service.js'), 'utf8');
  assert.match(inventory, /getActiveReservedQuantities/);
  assert.match(inventory, /UNRESOLVED_PAYMENT_STATUSES = \['authorized'\]/);
});

test('permanent delete route is admin-only and archive route is unchanged', () => {
  const routes = fs.readFileSync(path.join(backendRoot, 'src/routes/artwork.routes.js'), 'utf8');
  assert.match(routes, /delete\('\/:id\/permanent'/);
  assert.match(routes, /delete\('\/:id', validate\(\{ params: uuidParam \}\), asyncHandler\(archiveAdminArtwork\)\)/);
  assert.ok(routes.indexOf("delete('/:id/permanent'") < routes.indexOf("delete('/:id', validate({ params: uuidParam }), asyncHandler(archiveAdminArtwork)"));
});

afterEach(() => {
  resetAuthDependencies();
});

after(async () => {
  await stopTestServer();
});

test('unauthenticated permanent delete returns 401', async () => {
  const response = await api(`/api/v1/admin/artworks/${artworkId}/permanent`, { method: 'DELETE' });
  assert.equal(response.status, 401);
});

test('customer permanent delete returns 403', async () => {
  setAuthDependencies({
    verifyAccessToken: async () => ({
      userId: customerId,
      email: 'customer@example.com',
      fullName: 'Customer',
    }),
    provisionIdentity: async () => {},
    loadProfileWithRoles: async () => ({
      profile: { id: customerId, fullName: 'Customer' },
      roles: ['customer'],
    }),
  });
  const response = await api(`/api/v1/admin/artworks/${artworkId}/permanent`, {
    method: 'DELETE',
    headers: { Authorization: 'Bearer customer-token' },
  });
  assert.equal(response.status, 403);
});
