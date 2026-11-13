import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import {
  createArtworkDisplayDerivative,
  loadArtworkDisplayDerivative,
  DISPLAY_MAX_EDGE,
} from '../lib/artwork-display.js';
import {
  artworkDisplayPath,
  artworkImageUrl,
  artworkStorefrontImageUrl,
  displayDerivativeStoragePath,
  isArtworkDisplayDerivativePath,
  isSafeArtworkDisplayPath,
} from '../lib/media.js';

test('display paths only accept catalogued artwork-image object keys', () => {
  const storagePath = '8f3171f4-acbf-4024-a8d8-c7471b3644d5/1760000000-lotus.png';
  assert.equal(isSafeArtworkDisplayPath(storagePath), true);
  assert.equal(artworkDisplayPath(storagePath), `/media/display/${storagePath}`);
  assert.equal(isSafeArtworkDisplayPath('../secret.png'), false);
  assert.equal(isSafeArtworkDisplayPath('lot/one.jpg'), false);
  assert.equal(artworkDisplayPath('../secret.png'), null);
});

test('storefront cards use versioned display URLs while admin originals stay on Storage', () => {
  const artwork = {
    images: [{
      storagePath: '506b0baa-f6e2-4d19-9922-7979b314fa69/1-moment.jpg',
      isPrimary: true,
    }],
  };
  assert.match(artworkStorefrontImageUrl(artwork), /\/media\/display\/506b0baa-f6e2-4d19-9922-7979b314fa69\/1-moment\.jpg/);
  assert.doesNotMatch(artworkImageUrl(artwork) || '', /\/media\/display\//);
});

test('display sibling paths stay next to the original and are never registered as originals', () => {
  const storagePath = '8f3171f4-acbf-4024-a8d8-c7471b3644d5/1760000000-lotus.png';
  assert.equal(displayDerivativeStoragePath(storagePath), `${storagePath}.display.webp`);
  assert.equal(isArtworkDisplayDerivativePath(`${storagePath}.display.webp`), true);
  assert.equal(isArtworkDisplayDerivativePath(storagePath), false);
  assert.equal(displayDerivativeStoragePath(`${storagePath}.display.webp`), null);
  assert.equal(artworkDisplayPath(`${storagePath}.display.webp`), null);
});

test('public display prefers a pre-generated sibling over fetching the original', async () => {
  const storagePath = `8f3171f4-acbf-4024-a8d8-c7471b3644d5/${Date.now()}-sibling-prefer.png`;
  const sibling = Buffer.from('webp-sibling');
  const requested = [];
  const previous = process.env.NEXT_PUBLIC_SUPABASE_URL;
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  try {
    const result = await loadArtworkDisplayDerivative(storagePath, {
      fetchImpl: async (url) => {
        requested.push(String(url));
        if (String(url).endsWith('.display.webp')) {
          return new Response(sibling, { status: 200 });
        }
        return new Response('original-should-not-load', { status: 200 });
      },
    });
    assert.equal(result.ok, true);
    assert.equal(result.source, 'sibling');
    assert.equal(Buffer.compare(result.buffer, sibling), 0);
    assert.equal(requested.some((url) => url.endsWith('.display.webp')), true);
    assert.equal(requested.some((url) => url.includes('sibling-prefer.png') && !url.endsWith('.display.webp')), false);
  } finally {
    if (previous === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_URL = previous;
    }
  }
});

test('public display falls back to on-demand generation when the sibling is missing', async () => {
  const storagePath = `8f3171f4-acbf-4024-a8d8-c7471b3644d5/${Date.now()}-on-demand.png`;
  const original = await sharp({
    create: { width: 400, height: 300, channels: 3, background: { r: 20, g: 40, b: 80 } },
  }).png().toBuffer();
  const previous = process.env.NEXT_PUBLIC_SUPABASE_URL;
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  try {
    const result = await loadArtworkDisplayDerivative(storagePath, {
      fetchImpl: async (url) => {
        if (String(url).endsWith('.display.webp')) {
          return new Response('missing', { status: 404 });
        }
        return new Response(original, { status: 200 });
      },
    });
    assert.equal(result.ok, true);
    assert.equal(result.source, 'generated');
    const info = await sharp(result.buffer).metadata();
    assert.equal(info.format, 'webp');
  } finally {
    if (previous === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_URL = previous;
    }
  }
});

test('display derivatives shrink to a bounded WebP without replacing the original buffer', async () => {
  const original = await sharp({
    create: { width: 2400, height: 1800, channels: 3, background: { r: 80, g: 40, b: 20 } },
  }).png().toBuffer();
  const derived = await createArtworkDisplayDerivative(original);
  const meta = await sharp(derived).metadata();
  assert.equal(meta.format, 'webp');
  assert.ok(meta.width <= DISPLAY_MAX_EDGE);
  assert.ok(meta.height <= DISPLAY_MAX_EDGE);
  assert.ok(derived.length < original.length);
});
