'use client';

import { formatFileBytes } from '@/lib/artwork-image-constraints';
import {
  ARTWORK_IMAGE_CONSTRAINTS_UNAVAILABLE_MESSAGE,
  ARTWORK_IMAGE_CONSTRAINTS_UNAVAILABLE_TITLE,
} from '@/lib/artwork-image-constraints-copy';
import { pendingButtonProps } from '@/lib/pending-action';
import { InlineLoader } from './loading';

export function artworkImageLimitsCopy(constraints) {
  if (!constraints) {
    return { limitLabel: null, typesLabel: null };
  }
  const limitLabel = Number.isFinite(Number(constraints.fileSizeLimitBytes))
    ? formatFileBytes(constraints.fileSizeLimitBytes)
    : null;
  const typesLabel = Array.isArray(constraints.allowedMimeTypes) && constraints.allowedMimeTypes.length > 0
    ? constraints.allowedMimeTypes.join(', ')
    : null;
  return { limitLabel, typesLabel };
}

export function isArtworkImagePickerBlocked({ constraints, constraintsLoading } = {}) {
  return Boolean(constraintsLoading || !constraints);
}

export function ArtworkImageConstraintsStatus({
  constraints,
  constraintsError,
  constraintsLoading,
  onRetry,
}) {
  const blocked = Boolean(constraintsError || (!constraints && !constraintsLoading));
  const { limitLabel, typesLabel } = artworkImageLimitsCopy(constraints);

  return (
    <div className="space-y-3">
      {constraintsLoading && !constraints ? (
        <InlineLoader label="Loading artwork-images bucket limits…" />
      ) : null}
      {blocked ? (
        <div className="notice notice-error space-y-3" role="alert">
          <p className="label-md">{ARTWORK_IMAGE_CONSTRAINTS_UNAVAILABLE_TITLE}</p>
          <p>{ARTWORK_IMAGE_CONSTRAINTS_UNAVAILABLE_MESSAGE}</p>
          {typeof onRetry === 'function' ? (
            <button
              className="btn-secondary"
              type="button"
              onClick={onRetry}
              {...pendingButtonProps(constraintsLoading)}
            >
              {constraintsLoading ? 'Retrying…' : 'Retry'}
            </button>
          ) : null}
        </div>
      ) : null}
      {constraints && !blocked && (limitLabel || typesLabel) ? (
        <p className="text-sm text-on-surface-variant">
          {limitLabel ? `Maximum size: ${limitLabel}.` : 'This bucket does not publish a file size limit.'}
          {typesLabel ? ` Allowed types: ${typesLabel}.` : ''}
        </p>
      ) : null}
    </div>
  );
}
