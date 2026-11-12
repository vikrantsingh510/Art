import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FALLBACK_SEARCH,
  SCENE_VIEWER_ACTION,
  SCENE_VIEWER_PACKAGE,
  describeSceneViewerBlock,
  isSceneViewerOrigin,
  publicOriginFromHeaders,
  sceneViewerHttpsUrl,
  sceneViewerIntent,
  sceneViewerLaunch,
} from '../lib/ar-poc-scene-viewer.js';

test('Scene Viewer intent matches the official Google-app VIEW launch', () => {
  const glbUrl = 'https://example.trycloudflare.com/dev/ar-poc/painting.glb';
  const fallbackUrl = `https://example.trycloudflare.com/dev/ar-poc?${FALLBACK_SEARCH}`;
  const intent = sceneViewerIntent({
    glbUrl,
    fallbackUrl,
    title: 'A Moment of Innocence',
  });

  assert.match(intent, /^intent:\/\/arvr\.google\.com\/scene-viewer\/1\.0\?/);
  assert.match(intent, /file=https:\/\/example\.trycloudflare\.com\/dev\/ar-poc\/painting\.glb/);
  assert.equal(intent.includes('file=https%3A%2F%2F'), false);
  assert.match(intent, /mode=ar_preferred/);
  assert.match(intent, /resizable=false/);
  assert.match(intent, /enable_vertical_placement=true/);
  assert.match(intent, /title=A%20Moment%20of%20Innocence/);
  assert.equal(intent.includes('A+Moment'), false);
  assert.match(intent, new RegExp(`package=${SCENE_VIEWER_PACKAGE}`));
  assert.match(intent, new RegExp(`action=${SCENE_VIEWER_ACTION}`));
  assert.match(intent, /scheme=https/);
  assert.match(intent, /S\.browser_fallback_url=https%3A%2F%2Fexample\.trycloudflare\.com%2Fdev%2Far-poc%3Far%3Dfallback;end;$/);
  assert.equal(intent.includes('com.google.ar.core'), false);
  assert.equal(intent.includes(encodeURIComponent(glbUrl) + ';end'), false);
});

test('Scene Viewer intent rejects HTTP GLB URLs, GLB fallbacks, and same-page fallbacks', () => {
  assert.throws(() => sceneViewerIntent({
    glbUrl: 'http://192.168.1.12:3000/dev/ar-poc/painting.glb',
    fallbackUrl: 'http://192.168.1.12:3000/dev/ar-poc?ar=fallback',
  }));
  assert.throws(() => sceneViewerIntent({
    glbUrl: 'https://example.com/dev/ar-poc/painting.glb',
    fallbackUrl: 'https://example.com/dev/ar-poc/painting.glb',
  }));
  assert.throws(() => sceneViewerIntent({
    glbUrl: 'https://example.com/dev/ar-poc/painting.glb',
    fallbackUrl: 'https://example.com/dev/ar-poc',
  }));
});

test('launch helper builds intent and HTTPS URLs from a public origin', () => {
  const launch = sceneViewerLaunch({
    origin: 'https://conscious-lid-allowing-chicken.trycloudflare.com',
    title: 'A Moment of Innocence',
  });
  assert.match(launch.intent, /^intent:\/\//);
  assert.match(launch.httpsUrl, /^https:\/\/arvr\.google\.com\/scene-viewer\/1\.0\?/);
  assert.match(launch.fallbackUrl, /\?ar=fallback$/);
  assert.equal(sceneViewerLaunch({ origin: 'http://192.168.1.12:3000' }), null);
  assert.equal(isSceneViewerOrigin('https://example.com'), true);
  assert.equal(isSceneViewerOrigin('http://localhost:3000'), false);
});

test('intent encodes file URLs only when they contain intent delimiters', () => {
  const intent = sceneViewerIntent({
    glbUrl: 'https://example.com/model.glb?token=a&b=1',
    fallbackUrl: 'https://example.com/dev/ar-poc?ar=fallback',
  });
  assert.match(intent, /file=https%3A%2F%2Fexample.com%2Fmodel.glb%3Ftoken%3Da%26b%3D1/);
});

test('HTTPS Scene Viewer URL encodes the GLB once and does not point at the GLB path', () => {
  const httpsUrl = sceneViewerHttpsUrl({
    glbUrl: 'https://example.com/dev/ar-poc/painting.glb',
    title: 'A Moment of Innocence',
  });
  assert.equal(httpsUrl.startsWith('https://arvr.google.com/scene-viewer/1.0?'), true);
  assert.match(httpsUrl, /file=https%3A%2F%2Fexample.com%2Fdev%2Far-poc%2Fpainting.glb/);
  assert.equal(httpsUrl.includes('/dev/ar-poc/painting.glb?'), false);
});

test('launch is blocked with a visible reason when origin or UA is wrong', () => {
  assert.match(
    describeSceneViewerBlock({ origin: 'http://192.168.1.12:3000', userAgent: 'Android' }),
    /HTTPS/,
  );
  assert.match(
    describeSceneViewerBlock({ origin: 'https://example.com', userAgent: 'Macintosh' }),
    /Android Chrome/,
  );
  assert.equal(
    describeSceneViewerBlock({ origin: 'https://example.com', userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/120' }),
    null,
  );
});

test('public origin prefers forwarded host and proto', () => {
  const headers = new Map([
    ['x-forwarded-host', 'conscious-lid-allowing-chicken.trycloudflare.com'],
    ['x-forwarded-proto', 'https'],
    ['host', 'localhost:3000'],
  ]);
  assert.equal(
    publicOriginFromHeaders(headers),
    'https://conscious-lid-allowing-chicken.trycloudflare.com',
  );
});
