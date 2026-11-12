import { shouldShowArLaunchButton } from '../ar-poc-model-viewer.js';

export const AR_LAUNCH_FAILED_COPY =
  'AR could not start. Try again, or use a browser that supports WebXR (Android Chrome) or Quick Look (iPhone Safari).';

export const AR_LAUNCH_UNAVAILABLE_COPY = 'AR is not available in this browser yet.';

export function arLaunchFailureCopy(error) {
  const message = error && error.message ? String(error.message).trim() : '';
  if (!message) {
    return AR_LAUNCH_FAILED_COPY;
  }
  return `AR could not start (${message}). Try again, or use a browser that supports WebXR (Android Chrome) or Quick Look (iPhone Safari).`;
}

/**
 * Activate Model Viewer AR without claiming success up front.
 * Handles synchronous throws and thenable rejections.
 */
export async function activateArtworkAr(element, { canActivateAR } = {}) {
  if (!element || typeof element.activateAR !== 'function') {
    throw new Error('The 3D viewer is not ready.');
  }
  if (!shouldShowArLaunchButton(canActivateAR)) {
    throw new Error(AR_LAUNCH_UNAVAILABLE_COPY);
  }
  const result = element.activateAR();
  if (result != null && typeof result.then === 'function') {
    await result;
  }
}
