/**
 * Isolated Scene Viewer intent builder for the AR POC route.
 * Not used by production ArViewer.
 *
 * Official web launch (Google HTML docs): intent:// to
 * com.google.android.googlequicksearchbox with android.intent.action.VIEW.
 * Chrome uses S.browser_fallback_url when that intent cannot be resolved.
 * That fallback must be a distinct HTML page, never the GLB and never the
 * exact same URL (a same-URL fallback looks like the button did nothing).
 */

export const SCENE_VIEWER_PACKAGE = 'com.google.android.googlequicksearchbox';
export const SCENE_VIEWER_ACTION = 'android.intent.action.VIEW';
export const GLB_PATH = '/dev/ar-poc/painting.glb';
export const POC_PATH = '/dev/ar-poc';
export const FALLBACK_SEARCH = 'ar=fallback';
export const KNOWN_GOOD_SCENE_VIEWER_HREF =
  'intent://arvr.google.com/scene-viewer/1.0?file=https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Avocado/glTF/Avocado.gltf#Intent;scheme=https;package=com.google.android.googlequicksearchbox;action=android.intent.action.VIEW;S.browser_fallback_url=https://developers.google.com/ar;end;';

export function publicOriginFromHeaders(headerStore) {
  const forwardedHost = headerStore.get('x-forwarded-host');
  const host = (forwardedHost || headerStore.get('host') || '').split(',')[0].trim();
  if (!host) {
    return '';
  }
  const forwardedProto = headerStore.get('x-forwarded-proto');
  const proto = (forwardedProto || 'http').split(',')[0].trim();
  return `${proto}://${host}`;
}

export function isSceneViewerOrigin(origin) {
  return /^https:\/\//i.test(origin);
}

export function isAndroidUserAgent(userAgent) {
  return /android/i.test(userAgent || '');
}

function encodeIntentQuery(entries) {
  return entries
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');
}

function fileParamForIntent(glbUrl) {
  // Google's HTML sample leaves a simple https file URL unencoded. Chrome's
  // intent parser has been observed to ignore fully percent-encoded file= values
  // without following S.browser_fallback_url. Encode only characters that would
  // break the intent query or #Intent fragment.
  if (/[&#;]/.test(glbUrl)) {
    return encodeURIComponent(glbUrl);
  }
  return glbUrl;
}

export function sceneViewerHttpsUrl({ glbUrl, title }) {
  if (!/^https:\/\//i.test(glbUrl)) {
    throw new Error('Scene Viewer file URL must be HTTPS.');
  }
  const entries = [
    ['file', glbUrl],
    ['mode', 'ar_preferred'],
    ['resizable', 'false'],
    ['enable_vertical_placement', 'true'],
  ];
  if (title) {
    entries.push(['title', title]);
  }
  return `https://arvr.google.com/scene-viewer/1.0?${encodeIntentQuery(entries)}`;
}

export function sceneViewerIntent({ glbUrl, fallbackUrl, title }) {
  if (!/^https:\/\//i.test(glbUrl)) {
    throw new Error('Scene Viewer file URL must be HTTPS.');
  }
  if (!fallbackUrl || /\.glb(\?|#|$)/i.test(fallbackUrl)) {
    throw new Error('Scene Viewer fallback must be an HTML page, not the GLB.');
  }
  if (!fallbackUrl.includes(FALLBACK_SEARCH) && !fallbackUrl.includes('#')) {
    throw new Error('Scene Viewer fallback must use a distinct query or hash so a failed launch is visible.');
  }

  const query = [
    'mode=ar_preferred',
    'resizable=false',
    'enable_vertical_placement=true',
    title ? `title=${encodeURIComponent(title)}` : null,
    `file=${fileParamForIntent(glbUrl)}`,
  ].filter(Boolean).join('&');

  return `intent://arvr.google.com/scene-viewer/1.0?${query}#Intent;scheme=https;package=${SCENE_VIEWER_PACKAGE};action=${SCENE_VIEWER_ACTION};S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};end;`;
}

export function sceneViewerLaunch({ origin, title }) {
  if (!isSceneViewerOrigin(origin)) {
    return null;
  }
  const base = origin.replace(/\/$/, '');
  const glbUrl = `${base}${GLB_PATH}`;
  const fallbackUrl = `${base}${POC_PATH}?${FALLBACK_SEARCH}`;
  return {
    glbUrl,
    fallbackUrl,
    httpsUrl: sceneViewerHttpsUrl({ glbUrl, title }),
    intent: sceneViewerIntent({ glbUrl, fallbackUrl, title }),
  };
}

export function describeSceneViewerBlock({ origin, userAgent }) {
  if (!isSceneViewerOrigin(origin)) {
    return 'Scene Viewer needs a public HTTPS page so it can fetch the GLB. Open this route through the HTTPS tunnel in Android Chrome.';
  }
  if (!isAndroidUserAgent(userAgent)) {
    return 'Scene Viewer only launches from Android Chrome. Open this HTTPS URL on a physical Android phone.';
  }
  return null;
}
