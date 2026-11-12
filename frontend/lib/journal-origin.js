import { headers } from 'next/headers';

export async function siteOrigin() {
  const requestHeaders = await headers();
  const host = requestHeaders.get('x-forwarded-host') || requestHeaders.get('host');
  if (!host) {
    return '';
  }
  const proto = requestHeaders.get('x-forwarded-proto') || 'https';
  return `${proto}://${host}`;
}

export async function journalCanonical(path) {
  const origin = await siteOrigin();
  return origin ? `${origin}${path}` : path;
}

export async function canonicalFor(path) {
  return journalCanonical(path);
}
