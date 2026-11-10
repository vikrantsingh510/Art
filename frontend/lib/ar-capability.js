export function isSecureArContext(locationLike = globalThis.location) {
  if (!locationLike) {
    return false;
  }
  const protocol = locationLike.protocol;
  const hostname = locationLike.hostname;
  return protocol === 'https:' || hostname === 'localhost' || hostname === '127.0.0.1';
}

export function detectArCapability({
  xr = globalThis.navigator?.xr,
  locationLike = globalThis.location,
  userAgent = globalThis.navigator?.userAgent || '',
} = {}) {
  const secure = isSecureArContext(locationLike);
  const hasWebXr = Boolean(xr && typeof xr.isSessionSupported === 'function');
  const ios = /iPad|iPhone|iPod/.test(userAgent) || (userAgent.includes('Mac') && 'ontouchend' in (globalThis.document || {}));

  return {
    secure,
    hasWebXr,
    ios,
    liveArLikely: Boolean(secure && hasWebXr && !ios),
    photoFallback: true,
  };
}

export async function isImmersiveArSupported(xr = globalThis.navigator?.xr) {
  if (!xr || typeof xr.isSessionSupported !== 'function') {
    return false;
  }
  try {
    return Boolean(await xr.isSessionSupported('immersive-ar'));
  } catch {
    return false;
  }
}

export function stopMediaStream(stream) {
  if (!stream || typeof stream.getTracks !== 'function') {
    return 0;
  }
  const tracks = stream.getTracks();
  tracks.forEach((track) => {
    if (typeof track.stop === 'function') {
      track.stop();
    }
  });
  return tracks.length;
}
