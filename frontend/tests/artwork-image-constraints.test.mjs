import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ARTWORK_IMAGES_BUCKET,
  acceptAttributeFromConstraints,
  formatFileBytes,
  validateArtworkImageFile,
} from '../lib/artwork-image-constraints.js';
import { artworkImagesUploadUrl, uploadArtworkImageFile } from '../lib/artwork-image-upload.js';

/**
 * Copied from the development `storage.buckets` row for `artwork-images`
 * (inspected 10 November 2026). The validator must consume this object as
 * data. It must not bake a second limit of its own.
 */
const DEVELOPMENT_ARTWORK_IMAGES = {
  bucket: ARTWORK_IMAGES_BUCKET,
  fileSizeLimitBytes: 10_485_760,
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
};

function file({ name = 'lot.jpg', type = 'image/jpeg', size }) {
  return { name, type, size };
}

test('formats the actual bucket limit rather than a hardcoded phrase', () => {
  assert.equal(formatFileBytes(DEVELOPMENT_ARTWORK_IMAGES.fileSizeLimitBytes), '10 MB');
  assert.equal(formatFileBytes(2048), '2 KB');
  assert.equal(
    acceptAttributeFromConstraints(DEVELOPMENT_ARTWORK_IMAGES),
    'image/jpeg,image/png,image/webp,image/avif',
  );
});

test('accepts a JPEG below the actual artwork-images limit', () => {
  const result = validateArtworkImageFile(
    file({ size: DEVELOPMENT_ARTWORK_IMAGES.fileSizeLimitBytes - 1 }),
    DEVELOPMENT_ARTWORK_IMAGES,
  );
  assert.equal(result.ok, true);
});

test('accepts a file exactly at the actual artwork-images limit', () => {
  const result = validateArtworkImageFile(
    file({ type: 'image/png', size: DEVELOPMENT_ARTWORK_IMAGES.fileSizeLimitBytes }),
    DEVELOPMENT_ARTWORK_IMAGES,
  );
  assert.equal(result.ok, true);
});

test('rejects a file one byte over the actual artwork-images limit', () => {
  const result = validateArtworkImageFile(
    file({ size: DEVELOPMENT_ARTWORK_IMAGES.fileSizeLimitBytes + 1 }),
    DEVELOPMENT_ARTWORK_IMAGES,
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, 'size');
  assert.match(result.message, /10 MB/);
  assert.match(result.message, /artwork-images bucket/);
});

test('rejects MIME types the artwork-images bucket does not list', () => {
  const gif = validateArtworkImageFile(
    file({ name: 'lot.gif', type: 'image/gif', size: 100 }),
    DEVELOPMENT_ARTWORK_IMAGES,
  );
  assert.equal(gif.ok, false);
  assert.equal(gif.code, 'mime');
  assert.match(gif.message, /image\/jpeg/);
  assert.match(gif.message, /image\/webp/);

  const pdf = validateArtworkImageFile(
    file({ name: 'lot.pdf', type: 'application/pdf', size: 100 }),
    DEVELOPMENT_ARTWORK_IMAGES,
  );
  assert.equal(pdf.ok, false);
  assert.equal(pdf.code, 'mime');
});

test('follows injected bucket settings instead of a frontend constant', () => {
  const tight = {
    bucket: ARTWORK_IMAGES_BUCKET,
    fileSizeLimitBytes: 1024,
    allowedMimeTypes: ['image/gif'],
  };
  assert.equal(validateArtworkImageFile(file({ type: 'image/gif', size: 1024 }), tight).ok, true);
  assert.equal(validateArtworkImageFile(file({ type: 'image/gif', size: 1025 }), tight).ok, false);
  assert.equal(validateArtworkImageFile(file({ type: 'image/jpeg', size: 10 }), tight).ok, false);
  assert.equal(
    validateArtworkImageFile(file({ size: 10_485_760 }), tight).ok,
    false,
    '10 MiB must fail when the bucket limit argument is 1024',
  );
});

test('does not invent a size or MIME rule when the bucket leaves them unset', () => {
  const open = { bucket: ARTWORK_IMAGES_BUCKET, fileSizeLimitBytes: null, allowedMimeTypes: null };
  assert.equal(validateArtworkImageFile(file({ type: 'image/gif', size: 50_000_000 }), open).ok, true);
});

test('blocks upload when bucket constraints were not loaded', () => {
  const result = validateArtworkImageFile(file({ size: 10 }), null);
  assert.equal(result.ok, false);
  assert.equal(result.code, 'constraints_unavailable');
});

test('builds the Storage object URL from the artwork-images bucket', () => {
  assert.equal(
    artworkImagesUploadUrl('https://example.supabase.co', 'lot-id/file.jpg'),
    'https://example.supabase.co/storage/v1/object/artwork-images/lot-id/file.jpg',
  );
});

test('reports upload progress and does not send a service-role header', async () => {
  const headers = {};
  let progress = 0;
  const xhr = {
    upload: {},
    status: 200,
    responseText: '{}',
    open() {},
    setRequestHeader(name, value) {
      headers[name] = value;
    },
    send() {
      this.upload.onprogress({ lengthComputable: true, loaded: 50, total: 100 });
      this.onload();
    },
  };

  await uploadArtworkImageFile({
    supabaseUrl: 'https://example.supabase.co',
    publishableKey: 'sb_publishable_test',
    accessToken: 'user-jwt',
    path: 'id/file.jpg',
    file: file({ size: 10 }),
    onProgress: (value) => {
      progress = value;
    },
    xhrFactory: () => xhr,
  });

  assert.equal(progress, 100);
  assert.equal(headers.Authorization, 'Bearer user-jwt');
  assert.equal(headers.apikey, 'sb_publishable_test');
  assert.equal(headers['x-upsert'], 'false');
  assert.equal(Object.values(headers).some((value) => String(value).includes('service_role')), false);
});
