import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return fs.readFileSync(path.join(frontendRoot, relativePath), 'utf8');
}

test('public artwork page keeps the AR panel and does not unmount Model Viewer', () => {
  const page = read('app/(gallery)/artwork/[id]/page.js');
  const panel = read('components/artwork-ar-panel.js');
  const viewer = read('components/artwork-model-viewer.js');

  assert.match(page, /ArtworkArPanel/);
  assert.match(page, /ArViewer/);
  assert.match(panel, /import\('\.\/artwork-model-viewer\.js'\)/);
  assert.match(panel, /interactive=\{false\}/);
  assert.match(panel, /launchLabel="View on your wall"/);
  assert.match(panel, /shouldMountModelViewer/);
  assert.match(panel, /shouldShowViewOnWall/);
  assert.match(panel, /onArAvailable/);
  assert.match(viewer, /activateArtworkAr/);
  assert.match(viewer, /canActivateAR/);
});

test('storefront AR panel drops orbit copy and keeps physical size plus wall CTA', () => {
  const panel = read('components/artwork-ar-panel.js');
  assert.match(panel, /Actual size \{ar\.physicalLabel\}/);
  assert.match(panel, /View on your wall places this size on a vertical surface/);
  assert.match(panel, /View on your wall appears on devices that can start AR/);
  assert.match(panel, /Android Chrome uses WebXR first/);
  assert.match(panel, /iPhone Quick Look/);
  assert.doesNotMatch(panel, /True-to-scale preview/);
  assert.doesNotMatch(panel, /Interactive 3D/);
  assert.doesNotMatch(panel, /Drag to orbit/);
  assert.doesNotMatch(panel, /Loading 3D viewer/);
});

test('storefront Model Viewer keeps the AR host and omits orbit controls', () => {
  const viewer = read('components/artwork-model-viewer.js');
  const css = read('app/globals.css');

  assert.match(viewer, /interactive = true/);
  assert.match(viewer, /ios-src=\{iosSrc\}/);
  assert.match(viewer, /ar-modes=\{MODEL_VIEWER_AR_MODES\}/);
  assert.match(viewer, /ar-placement="wall"/);
  assert.match(viewer, /ar-scale="fixed"/);
  assert.match(viewer, /data-ar-launch="model-viewer"/);
  assert.match(viewer, /data-ar-runtime="storefront"/);
  assert.match(viewer, /artwork-ar-runtime-viewer/);
  assert.match(viewer, /width: '4rem', height: '4rem', display: 'block'/);
  assert.match(viewer, /'camera-controls': true/);
  assert.match(viewer, /'camera-orbit': '0deg 75deg 105%'/);
  assert.match(css, /\.artwork-ar-runtime\s*\{[^}]*width:\s*4rem/);
  assert.match(css, /\.artwork-ar-runtime\s*\{[^}]*height:\s*4rem/);
  assert.doesNotMatch(css, /\.artwork-ar-runtime[\s\S]{0,180}display:\s*none/);
  assert.match(viewer, /className: 'artwork-ar-runtime-viewer',\s*style: \{ width: '4rem', height: '4rem', display: 'block' \}/);
});

test('dev AR PoC keeps the interactive orbit viewer by default', () => {
  const poc = read('app/dev/ar-poc/model-viewer-element.js');
  const viewer = read('components/artwork-model-viewer.js');
  const client = read('app/dev/ar-poc/poc-client.js');

  assert.match(poc, /ArtworkModelViewer/);
  assert.doesNotMatch(poc, /interactive=\{false\}/);
  assert.match(viewer, /interactive = true/);
  assert.match(viewer, /height: 'min\(32rem, 70vh\)'/);
  assert.match(client, /import\('\.\/model-viewer-element\.js'\)/);
});
