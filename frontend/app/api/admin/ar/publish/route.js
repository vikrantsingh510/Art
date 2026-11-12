import { loadPrimaryImageBuffer, publishStagedArAssets } from '@/lib/ar-assets/admin-pipeline';
import { loadAdminArtwork, requireAdminApiUser } from '@/lib/ar-assets/admin-request';
import { createOperatorArStorage } from '@/lib/ar-assets/operator-env';
import { AR_ASSETS_BUCKET, AR_ASSETS_STAGING_BUCKET } from '@/lib/ar-assets/storage-paths';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request) {
  const auth = await requireAdminApiUser(request);
  if (!auth.ok) {
    return Response.json({ ok: false, error: auth.message }, { status: auth.status });
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const artworkId = body?.artworkId;
  const generationId = body?.generationId;
  if (!artworkId || !generationId || body?.confirm !== true) {
    return Response.json({
      ok: false,
      error: 'Publishing requires artworkId, generationId and explicit confirm: true.',
    }, { status: 400 });
  }

  const loaded = await loadAdminArtwork(artworkId, auth.token);
  if (!loaded.ok) {
    return Response.json({ ok: false, error: loaded.message }, { status: loaded.status });
  }

  const staging = createOperatorArStorage(process.env.AR_ASSETS_STAGING_BUCKET || AR_ASSETS_STAGING_BUCKET);
  if (!staging.ok) {
    return Response.json({ ok: false, error: staging.error }, { status: staging.status });
  }
  const publishing = createOperatorArStorage(process.env.AR_ASSETS_BUCKET || AR_ASSETS_BUCKET);
  if (!publishing.ok) {
    return Response.json({ ok: false, error: publishing.error }, { status: publishing.status });
  }

  try {
    const stagingBucket = await staging.storage.getBucket();
    const publishBucket = await publishing.storage.getBucket();
    if (!stagingBucket) {
      return Response.json({
        ok: false,
        error: 'The ar-assets-staging bucket was not found.',
      }, { status: 503 });
    }
    if (!publishBucket) {
      return Response.json({
        ok: false,
        error: 'The ar-assets bucket was not found.',
      }, { status: 503 });
    }

    const source = await loadPrimaryImageBuffer(loaded.artwork);
    const published = await publishStagedArAssets({
      artwork: loaded.artwork,
      generationId,
      stagingStorage: staging.storage,
      publishStorage: publishing.storage,
      sourceImageBuffer: source.ok ? source.buffer : null,
    });
    return Response.json({
      ok: published.ok === true,
      published: published.published === true,
      skipped: published.skipped === true,
      alreadyCurrent: published.alreadyCurrent === true,
      step: published.step,
      error: published.error || null,
      current: published.current || null,
      urls: published.urls || null,
    }, { status: published.ok ? 200 : 409 });
  } catch (error) {
    return Response.json({
      ok: false,
      error: error instanceof Error
        ? error.message
        : 'AR publishing failed. The previous current version was left unchanged.',
    }, { status: 500 });
  }
}
