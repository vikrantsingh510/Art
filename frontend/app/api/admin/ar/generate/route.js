import { generateAdminArAssets } from '@/lib/ar-assets/admin-pipeline';
import { loadAdminArtwork, requireAdminApiUser } from '@/lib/ar-assets/admin-request';
import { createOperatorArStorage } from '@/lib/ar-assets/operator-env';
import {
  cleanupExpiredStagingForArtwork,
  dropStagedGeneration,
  stageGeneratedArAssets,
} from '@/lib/ar-assets/staging';
import { AR_ASSETS_STAGING_BUCKET } from '@/lib/ar-assets/storage-paths';

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
  if (!artworkId) {
    return Response.json({ ok: false, error: 'An artwork id is required.' }, { status: 400 });
  }

  const loaded = await loadAdminArtwork(artworkId, auth.token);
  if (!loaded.ok) {
    return Response.json({ ok: false, error: loaded.message }, { status: loaded.status });
  }

  try {
    const result = await generateAdminArAssets(loaded.artwork);
    if (!result.ok) {
      return Response.json({
        ok: false,
        step: result.step,
        error: result.error,
        preview: result.preview,
        summary: result.summary,
      });
    }

    const stagedBucket = process.env.AR_ASSETS_STAGING_BUCKET || AR_ASSETS_STAGING_BUCKET;
    const staging = createOperatorArStorage(stagedBucket);
    if (!staging.ok) {
      return Response.json({ ok: false, error: staging.error }, { status: staging.status });
    }
    const bucket = await staging.storage.getBucket();
    if (!bucket) {
      return Response.json({
        ok: false,
        error: 'The ar-assets-staging bucket was not found.',
      }, { status: 503 });
    }

    let stagedAttempt = null;
    try {
      await cleanupExpiredStagingForArtwork(staging.storage, artworkId);
      stagedAttempt = await stageGeneratedArAssets({
        artworkId,
        generated: result.generated,
        storage: staging.storage,
      });
      return Response.json({
        ok: true,
        generationId: stagedAttempt.generationId,
        preview: result.preview,
        summary: result.summary,
        canPublish: result.preview.canPublish === true,
      });
    } catch (error) {
      if (stagedAttempt?.attemptId && stagedAttempt?.contentHash) {
        await dropStagedGeneration(
          staging.storage,
          artworkId,
          stagedAttempt.contentHash,
          stagedAttempt.attemptId,
        );
      }
      return Response.json({
        ok: false,
        step: 'stage',
        error: error instanceof Error
          ? error.message
          : 'AR meshes were generated but could not be stored for publish. Generate them again. The artwork was not changed.',
      }, { status: 500 });
    }
  } catch (error) {
    return Response.json({
      ok: false,
      error: error instanceof Error
        ? error.message
        : 'AR generation failed. The artwork was not changed.',
    }, { status: 500 });
  }
}
