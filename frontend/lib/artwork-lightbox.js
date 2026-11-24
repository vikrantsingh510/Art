export const ARTWORK_LIGHTBOX_MS = 200;

export function shouldDeferLightboxExit() {
  return !(globalThis.matchMedia && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches);
}
