import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { SIZE_GUIDE_PHOTO_FILES } from '@/lib/size-guide-photos';

export const runtime = 'nodejs';

const FILES = {
  sofa: SIZE_GUIDE_PHOTO_FILES.sofa,
  bed: SIZE_GUIDE_PHOTO_FILES.bed,
  bedroom: SIZE_GUIDE_PHOTO_FILES.bed,
  wall: SIZE_GUIDE_PHOTO_FILES.wall,
};

export async function GET(_request, { params }) {
  const { scene } = await params;
  const file = FILES[scene];
  if (!file) {
    return new Response('Not found', { status: 404 });
  }

  const buffer = await readFile(path.join(process.cwd(), 'assets', 'images', file));
  const type = buffer[0] === 0x89 && buffer[1] === 0x50
    ? 'image/png'
    : 'image/jpeg';
  return new Response(buffer, {
    headers: {
      'Content-Type': type,
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
