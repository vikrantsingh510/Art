'use client';

import { useState } from 'react';
import { inspectArtworkImageFile } from '@/lib/artwork-image-inspect';
import { acceptAttributeFromConstraints, validateArtworkImageFile } from '@/lib/artwork-image-constraints';
import { publicStorageUrl } from '@/lib/media';
import {
  ArtworkImageConstraintsStatus,
  isArtworkImagePickerBlocked,
} from './artwork-image-constraints-status';
import { Field } from './ui';

export function BlogCoverUpload({
  coverImagePath,
  coverAltText,
  constraints,
  constraintsError,
  constraintsLoading,
  onRetryConstraints,
  onPendingFile,
  onAltChange,
  onRemove,
}) {
  const [error, setError] = useState('');
  const [objectUrl, setObjectUrl] = useState(null);
  const previewUrl = objectUrl || publicStorageUrl(coverImagePath);

  async function onFileChange(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    setError('');
    try {
      const inspection = await inspectArtworkImageFile(file);
      const result = validateArtworkImageFile(file, constraints, inspection);
      if (!result.ok) {
        setError(result.message || 'This file cannot be used as a cover.');
        return;
      }
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
      setObjectUrl(URL.createObjectURL(file));
      onPendingFile(file);
    } catch (caught) {
      setError(caught.message || 'The cover file could not be inspected.');
    }
  }

  const pickerBlocked = isArtworkImagePickerBlocked({ constraints, constraintsLoading });

  return (
    <div className="space-y-4">
      <ArtworkImageConstraintsStatus
        constraints={constraints}
        constraintsError={constraintsError}
        constraintsLoading={constraintsLoading}
        onRetry={onRetryConstraints}
      />
      <Field label="Cover image" hint="Optional. Stored as blogs/{id}/cover.{ext} in artwork-images." error={error}>
        <input
          className="field-input"
          type="file"
          accept={acceptAttributeFromConstraints(constraints)}
          disabled={pickerBlocked}
          onChange={onFileChange}
        />
      </Field>
      {previewUrl ? (
        <div className="space-y-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt={coverAltText || 'Cover preview'} className="max-h-64 object-contain bg-surface-container-low" />
          <button
            className="text-link"
            type="button"
            onClick={() => {
              if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
                setObjectUrl(null);
              }
              onRemove();
            }}
          >
            Remove cover
          </button>
        </div>
      ) : null}
      <Field label="Cover alt text">
        <input className="field-input" value={coverAltText} onChange={(event) => onAltChange(event.target.value)} />
      </Field>
    </div>
  );
}
