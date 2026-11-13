import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createArtApi } from '../lib/api-client.js';
import { canShowArchiveAction } from '../lib/artwork-archive.js';
import { artworkPermanentDeleteConfirm } from '../lib/artwork-delete.js';

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return fs.readFileSync(path.join(frontendRoot, relativePath), 'utf8');
}

const artwork = {
  id: '11111111-1111-4111-8111-111111111111',
  title: 'Lotus study',
  status: 'archived',
};

test('delete action appears in the artwork list and edit page', () => {
  const list = read('app/admin/artworks/page.js');
  const edit = read('app/admin/artworks/[id]/edit/page.js');
  assert.match(list, /DeleteArtworkButton/);
  assert.match(list, /ArchiveArtworkButton/);
  assert.match(edit, /DeleteArtworkButton/);
  assert.doesNotMatch(edit, /ArchiveArtworkButton/);
});

test('archived artwork can still be deleted', () => {
  assert.equal(canShowArchiveAction(artwork), false);
  const list = read('app/admin/artworks/page.js');
  assert.match(list, /DeleteArtworkButton artworkId=\{artwork\.id\} title=\{artwork\.title\}/);
  assert.match(list, /canShowArchiveAction\(artwork\)/);
});

test('confirmation includes artwork title and ID', () => {
  const copy = artworkPermanentDeleteConfirm(artwork);
  assert.match(copy, /Lotus study/);
  assert.ok(copy.includes(artwork.id));
  assert.match(copy, /cannot be undone/i);
  assert.match(copy, /Archive them instead/);
});

test('cancel does not call the API', () => {
  const button = read('components/delete-artwork-button.js');
  assert.match(button, /window\.confirm\(artworkPermanentDeleteConfirm/);
  assert.match(button, /if \(!confirmed\) \{\s*return;/);
  assert.match(button, /await client\.deleteArtwork\(artworkId\)/);
  assert.doesNotMatch(button, /archiveArtwork/);
});

test('successful delete navigates back to the artwork list', () => {
  const button = read('components/delete-artwork-button.js');
  const edit = read('app/admin/artworks/[id]/edit/page.js');
  assert.match(button, /redirectTo = '\/admin\/artworks'/);
  assert.match(button, /router\.push\(redirectTo\)/);
  assert.match(button, /router\.refresh\(\)/);
  assert.match(edit, /DeleteArtworkButton artworkId=\{artwork\.id\} title=\{artwork\.title\}/);
});

test('409 displays the archive recommendation', () => {
  const button = read('components/delete-artwork-button.js');
  assert.match(button, /ActionStatus/);
  assert.match(button, /caught instanceof ApiClientError \? caught\.message/);
  const copy = artworkPermanentDeleteConfirm(artwork);
  assert.match(copy, /cannot be deleted\. Archive them instead/);
});

test('existing Archive action remains unchanged', () => {
  const archive = read('components/archive-artwork-button.js');
  assert.match(archive, /client\.archiveArtwork\(artworkId\)/);
  assert.doesNotMatch(archive, /deleteArtwork/);
  assert.match(archive, /does not hard-delete/);
  assert.equal(canShowArchiveAction({ status: 'published' }), true);
});

test('API client keeps archive and permanent delete on distinct paths', async () => {
  const calls = [];
  const api = createArtApi({
    baseUrl: 'http://api.test',
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), method: options.method });
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ success: true, data: { id: 'lot', deleted: true } }),
      };
    },
  });

  await api.archiveArtwork('lot-id', { token: 't' });
  await api.deleteArtwork('lot-id', { token: 't' });
  assert.equal(calls[0].method, 'DELETE');
  assert.match(calls[0].url, /\/api\/v1\/admin\/artworks\/lot-id$/);
  assert.doesNotMatch(calls[0].url, /permanent/);
  assert.equal(calls[1].method, 'DELETE');
  assert.match(calls[1].url, /\/api\/v1\/admin\/artworks\/lot-id\/permanent$/);
});
