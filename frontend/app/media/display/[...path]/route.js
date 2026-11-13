import { loadArtworkDisplayDerivative, DISPLAY_CACHE_CONTROL } from '@/lib/artwork-display';

export const runtime = 'nodejs';

export async function GET(_request, { params }) {
  const segments = (await params).path;
  const storagePath = (Array.isArray(segments) ? segments : [])
    .map((part) => decodeURIComponent(part))
    .join('/');
  const result = await loadArtworkDisplayDerivative(storagePath);
  if (!result.ok) {
    return new Response('Not found', { status: result.status || 404 });
  }

  return new Response(result.buffer, {
    headers: {
      'Content-Type': 'image/webp',
      'Cache-Control': DISPLAY_CACHE_CONTROL,
    },
  });
}
