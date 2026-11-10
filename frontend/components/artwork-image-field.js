'use client';

import { artworkImageUrl } from '@/lib/media';
import {
  acceptAttributeFromConstraints,
  formatFileBytes,
} from '@/lib/artwork-image-constraints';
import { InlineLoader } from './loading';
import { Field } from './ui';

export function ArtworkImageField({
  artwork,
  constraints,
  constraintsError,
  constraintsLoading,
  file,
  fileError,
  previewUrl,
  progress,
  onFileChange,
}) {
  const currentUrl = artworkImageUrl(artwork);
  const accept = acceptAttributeFromConstraints(constraints);
  const limitLabel = Number.isFinite(Number(constraints?.fileSizeLimitBytes))
    ? formatFileBytes(constraints.fileSizeLimitBytes)
    : null;
  const typesLabel = Array.isArray(constraints?.allowedMimeTypes) && constraints.allowedMimeTypes.length > 0
    ? constraints.allowedMimeTypes.join(', ')
    : null;

  return (
    <section className="space-y-5">
      <h2 className="font-display text-2xl">Public image</h2>
      <p className="text-sm text-on-surface-variant">
        The file is sent to the public `artwork-images` bucket, then the path is registered. Size and type limits come from that bucket, not from this form.
      </p>
      {constraintsLoading ? (
        <InlineLoader label="Loading artwork-images bucket limits…" />
      ) : null}
      {constraintsError ? <p className="notice notice-error">{constraintsError}</p> : null}
      {limitLabel || typesLabel ? (
        <p className="text-sm text-on-surface-variant">
          {limitLabel ? `Maximum size: ${limitLabel}.` : 'This bucket does not publish a file size limit.'}
          {typesLabel ? ` Allowed types: ${typesLabel}.` : ''}
        </p>
      ) : null}
      {currentUrl ? (
        <div className="space-y-2">
          <p className="label-md text-patina">Current catalogue image</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={currentUrl} alt={artwork?.title || 'Current artwork'} className="max-h-48 w-auto object-contain bg-surface-container-low" />
        </div>
      ) : null}
      <Field label="Image file" error={fileError}>
        <input
          className="field-input"
          name="imageFile"
          type="file"
          accept={accept}
          onChange={(event) => onFileChange(event.target.files?.[0] || null)}
        />
      </Field>
      {file ? (
        <div className="space-y-3 text-sm">
          <p>
            Selected: {file.name} · {formatFileBytes(file.size)}
            {limitLabel ? ` (maximum ${limitLabel})` : ''}
          </p>
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="Selected artwork preview" className="max-h-48 w-auto object-contain bg-surface-container-low" />
          ) : null}
        </div>
      ) : null}
      {typeof progress === 'number' ? (
        <div className="space-y-2">
          <p className="label-md text-patina" role="status" aria-live="polite">Upload progress {progress}%</p>
          <div className="upload-progress" aria-hidden="true">
            <span style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
          </div>
        </div>
      ) : null}
    </section>
  );
}
