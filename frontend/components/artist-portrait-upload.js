'use client';

import { useState } from 'react';
import { inspectArtworkImageFile } from '@/lib/artwork-image-inspect';
import { acceptAttributeFromConstraints, validateArtworkImageFile } from '@/lib/artwork-image-constraints';
import { publicStorageUrl } from '@/lib/media';
import { Field } from './ui';

export function ArtistPortraitUpload({
  profileImagePath,
  profileImageAlt,
  constraints,
  onPendingFile,
  onAltChange,
  onRemove,
}) {
  const [error, setError] = useState('');
  const [objectUrl, setObjectUrl] = useState(null);
  const previewUrl = objectUrl || publicStorageUrl(profileImagePath);

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
        setError(result.message || 'This file cannot be used as a portrait.');
        return;
      }
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
      setObjectUrl(URL.createObjectURL(file));
      onPendingFile(file);
    } catch (caught) {
      setError(caught.message || 'The portrait file could not be inspected.');
    }
  }

  return (
    <div className="space-y-4">
      <Field label="Portrait" hint="Optional. Stored as artists/{id}/portrait.{ext} in artwork-images." error={error}>
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
          <img src={previewUrl} alt={profileImageAlt || 'Portrait preview'} className="max-h-64 object-contain bg-surface-container-low" />
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
            Remove portrait
          </button>
        </div>
      ) : null}
      <Field label="Portrait alt text">
        <input className="field-input" value={profileImageAlt} onChange={(event) => onAltChange(event.target.value)} />
      </Field>
    </div>
  );
}
