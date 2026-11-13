import { requireAdminApiUser } from '@/lib/ar-assets/admin-request';
import { createArtworkDisplayDerivative } from '@/lib/artwork-display';

export const runtime = 'nodejs';

export async function POST(request) {
  const auth = await requireAdminApiUser(request);
  if (!auth.ok) {
    return Response.json({ ok: false, error: auth.message }, { status: auth.status });
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ ok: false, error: 'An image file is required.' }, { status: 400 });
  }

  const file = form.get('file');
  if (!file || typeof file.arrayBuffer !== 'function') {
    return Response.json({ ok: false, error: 'An image file is required.' }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    if (!buffer.length) {
      return Response.json({ ok: false, error: 'An image file is required.' }, { status: 400 });
    }
    const webp = await createArtworkDisplayDerivative(buffer);
    return new Response(webp, {
      headers: { 'Content-Type': 'image/webp' },
    });
  } catch {
    return Response.json({ ok: false, error: 'The display image could not be generated.' }, { status: 502 });
  }
}
