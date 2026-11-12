'use client';

import { useState } from 'react';
import { inspectArtworkImageFile } from '@/lib/artwork-image-inspect';
import { acceptAttributeFromConstraints, validateArtworkImageFile } from '@/lib/artwork-image-constraints';
import { publicStorageUrl } from '@/lib/media';
import { Field } from './ui';

export function CollectionCoverUpload({
  coverImagePath,
  constraints,
  onPendingFile,
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

  return (
    <div className="space-y-4">
      <Field label="Cover image" hint="Optional. Stored as collections/{id}/cover.{ext} in artwork-images." error={error}>
        <input
          className="field-input"
          type="file"
          accept={acceptAttributeFromConstraints(constraints)}
          onChange={onFileChange}
        />
      </Field>
      {previewUrl ? (
        <div className="space-y-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="Collection cover preview" className="max-h-64 object-contain bg-surface-container-low" />
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
      ) : (
        <div className="bg-surface-container-low aspect-[16/9] max-w-md flex items-end p-4">
          <p className="label-sm text-patina">No cover</p>
        </div>
      )}
    </div>
  );
}
