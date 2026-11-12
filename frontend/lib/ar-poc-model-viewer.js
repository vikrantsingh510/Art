/**
 * Isolated Model Viewer config for /dev/ar-poc.
 * Not imported by production ArViewer.
 */

export const POC_ARTWORK = {
  id: '506b0baa-f6e2-4d19-9922-7979b314fa69',
  title: 'A Moment of Innocence',
  artistName: 'Vishal Singh',
  width: 90,
  height: 120,
  unit: 'cm',
};

export const POC_ASSETS = {
  glb: '/dev/ar-poc/painting.glb?v=gltf-uv',
  usdz: '/dev/ar-poc/painting.usdz?v=gltf-uv',
  poster: '/dev/ar-poc/preview.jpg',
};

/**
 * WebXR first, then Scene Viewer, then Quick Look.
 *
 * Scene Viewer is still listed, but the Google app currently opens and
 * immediately returns (model-viewer #5210). Putting WebXR first keeps
 * Place on wall inside Chrome AR on the same tap.
 */
export const MODEL_VIEWER_AR_MODES = 'webxr scene-viewer quick-look';
export const SCENE_VIEWER_BOUNCE_HASH = '#model-viewer-no-ar-fallback';
export const SCENE_VIEWER_BOUNCE_COPY =
  'Google Scene Viewer opened and closed immediately. That is a current Google app bug, not the painting file. Tap Place on wall again to stay in Chrome AR (WebXR, wall, fixed scale).';

export function isSceneViewerBounceHash(hash) {
  return String(hash || '').includes('model-viewer-no-ar-fallback');
}

export const MODEL_VIEWER_ATTRIBUTES = {
  ar: true,
  arModes: MODEL_VIEWER_AR_MODES,
  arPlacement: 'wall',
  arScale: 'fixed',
  src: POC_ASSETS.glb,
  iosSrc: POC_ASSETS.usdz,
  poster: POC_ASSETS.poster,
  cameraControls: true,
  touchAction: 'pan-y',
  shadowIntensity: '0',
  environmentImage: 'neutral',
};

export const POC_PLANE = {
  widthCm: 80.64,
  heightCm: 120,
  widthM: 0.8064,
  heightM: 1.2,
  catalogueWidthCm: 90,
  catalogueHeightCm: 120,
  imagePixels: { width: 6720, height: 10000 },
  imageAspect: 0.672,
  physicalAspect: 0.75,
  mismatchPct: 10.4,
  stretched: false,
  marginFinding: 'no-uniform-margins',
};

export function dimensionMismatchCopy(plane = POC_PLANE) {
  return (
    `Catalogue size is ${plane.catalogueWidthCm} × ${plane.catalogueHeightCm} cm. ` +
    `The source JPEG is ${plane.imagePixels.width} × ${plane.imagePixels.height} ` +
    `(aspect ${plane.imageAspect} vs catalogue ${plane.physicalAspect}, ` +
    `about ${plane.mismatchPct}% difference). ` +
    `Edge luminance of the scan matches the painted field — there is no extra photographic margin to crop. ` +
    `The GLB/USDZ plane is ${plane.widthCm} × ${plane.heightCm} cm so the image is not stretched. ` +
    `Catalogue data is unchanged. Physical canvas measurement is still required before treating 90 cm as the on-wall width.`
  );
}

export function shouldShowArLaunchButton(canActivateAR) {
  return canActivateAR === true;
}

export function modelViewerStatusCopy(loadState, progress = 0, errorMessage = '') {
  if (loadState === 'loading') {
    return `Loading interactive 3D… ${progress}%`;
  }
  if (loadState === 'error') {
    return errorMessage || 'The 3D painting could not be loaded.';
  }
  if (loadState === 'ready') {
    return 'Drag to orbit. Zoom is viewing only and does not change the physical size.';
  }
  return '';
}
