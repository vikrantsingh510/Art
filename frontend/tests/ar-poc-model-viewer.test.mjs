import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MODEL_VIEWER_AR_MODES,
  MODEL_VIEWER_ATTRIBUTES,
  POC_ASSETS,
  POC_PLANE,
  SCENE_VIEWER_BOUNCE_HASH,
  dimensionMismatchCopy,
  isSceneViewerBounceHash,
  modelViewerStatusCopy,
  shouldShowArLaunchButton,
} from '../lib/ar-poc-model-viewer.js';

test('Model Viewer AR modes put WebXR first so Place on wall skips the Google app bounce', () => {
  assert.equal(MODEL_VIEWER_AR_MODES, 'webxr scene-viewer quick-look');
  assert.equal(MODEL_VIEWER_ATTRIBUTES.arModes, MODEL_VIEWER_AR_MODES);
  assert.equal(MODEL_VIEWER_ATTRIBUTES.arPlacement, 'wall');
  assert.equal(MODEL_VIEWER_ATTRIBUTES.arScale, 'fixed');
  assert.equal(MODEL_VIEWER_ATTRIBUTES.src, POC_ASSETS.glb);
  assert.equal(MODEL_VIEWER_ATTRIBUTES.iosSrc, POC_ASSETS.usdz);
  assert.equal(MODEL_VIEWER_ATTRIBUTES.ar, true);
});

test('POC plane keeps catalogue height and unstretched image width', () => {
  assert.equal(POC_PLANE.heightCm, 120);
  assert.equal(POC_PLANE.widthCm, 80.64);
  assert.equal(POC_PLANE.catalogueWidthCm, 90);
  assert.equal(POC_PLANE.stretched, false);
  assert.equal(POC_PLANE.marginFinding, 'no-uniform-margins');
  assert.match(dimensionMismatchCopy(), /no extra photographic margin/);
  assert.match(dimensionMismatchCopy(), /80\.64/);
});

test('Scene Viewer bounce hash is the Model Viewer fallback sigil', () => {
  assert.equal(SCENE_VIEWER_BOUNCE_HASH, '#model-viewer-no-ar-fallback');
  assert.equal(isSceneViewerBounceHash('#model-viewer-no-ar-fallback'), true);
  assert.equal(isSceneViewerBounceHash('https://example.com/dev/ar-poc#model-viewer-no-ar-fallback'), true);
  assert.equal(isSceneViewerBounceHash(''), false);
  assert.equal(isSceneViewerBounceHash('#other'), false);
});

test('Place on wall is shown only when Model Viewer canActivateAR is true', () => {
  assert.equal(shouldShowArLaunchButton(true), true);
  assert.equal(shouldShowArLaunchButton(false), false);
  assert.equal(shouldShowArLaunchButton(undefined), false);
  assert.equal(shouldShowArLaunchButton(null), false);
  assert.equal(shouldShowArLaunchButton('true'), false);
});

test('viewer status copy distinguishes loading, error and ready', () => {
  assert.match(modelViewerStatusCopy('loading', 12), /12%/);
  assert.match(modelViewerStatusCopy('error', 0, 'network'), /network/);
  assert.match(modelViewerStatusCopy('ready'), /does not change the physical size/);
});
