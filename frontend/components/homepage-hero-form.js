'use client';

import { useEffect, useState } from 'react';
import { inspectArtworkImageFile } from '@/lib/artwork-image-inspect';
import { createBrowserArtApi, getBrowserAccessToken } from '@/lib/browser-api';
import { ApiClientError } from '@/lib/api-client';
import { getSupabasePublishableKey, getSupabaseUrl, isSupabaseConfigured } from '@/lib/env';
import {
  HOMEPAGE_HERO_ALT_MAX_LENGTH,
  HOMEPAGE_HERO_FALLBACK_IMAGE,
  explainHomepageHeroUploadError,
  homepageHeroAcceptAttribute,
  persistHomepageHero,
  restoreHomepageHeroDefault,
  validateHomepageHeroFile,
} from '@/lib/homepage-hero';
import { publicStorageUrl } from '@/lib/media';
import { pendingButtonProps } from '@/lib/pending-action';
import { useArtworkImageConstraints } from '@/lib/use-artwork-image-constraints';
import {
  ArtworkImageConstraintsStatus,
  isArtworkImagePickerBlocked,
} from './artwork-image-constraints-status';
import { ActionStatus, ButtonLoader } from './loading';
import { Field } from './ui';

function fieldsFromHero(hero) {
  return {
    storagePath: hero?.storagePath || null,
    altText: hero?.altText || '',
  };
}

export function HomepageHeroForm({ hero = null }) {
  const [storagePath, setStoragePath] = useState(() => fieldsFromHero(hero).storagePath);
  const [altText, setAltText] = useState(() => fieldsFromHero(hero).altText);
  const [pendingFile, setPendingFile] = useState(null);
  const [objectUrl, setObjectUrl] = useState(null);
  const [fileError, setFileError] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const {
    constraints,
    constraintsError,
    constraintsLoading,
    retryConstraints,
  } = useArtworkImageConstraints();

  useEffect(() => () => {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
  }, [objectUrl]);

  const previewUrl = objectUrl || publicStorageUrl(storagePath) || HOMEPAGE_HERO_FALLBACK_IMAGE;
  const pickerBlocked = isArtworkImagePickerBlocked({ constraints, constraintsLoading });
  const isDefaultHero = !storagePath && !pendingFile;
  const previewCaption = pendingFile
    ? 'Unpublished preview. Save to publish this image on the homepage.'
    : storagePath
      ? 'Published homepage hero.'
      : 'Default salon image. This is the storefront fallback.';

  function clearPendingPreview() {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
    setObjectUrl(null);
    setPendingFile(null);
  }

  async function onFileChange(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    setFileError('');
    setError('');
    setMessage('');
    try {
      const inspection = await inspectArtworkImageFile(file);
      const result = validateHomepageHeroFile(file, constraints, inspection);
      if (!result.ok) {
        setFileError(result.message || 'This file cannot be used as the homepage hero.');
        return;
      }
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
      setObjectUrl(URL.createObjectURL(file));
      setPendingFile(file);
    } catch (caught) {
      setFileError(caught.message || 'The hero file could not be inspected.');
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (pending) {
      return;
    }
    setPending(true);
    setError('');
    setMessage('');
    try {
      if (!isSupabaseConfigured() && pendingFile) {
        throw new Error('Supabase is not configured for hero uploads.');
      }
      const client = await createBrowserArtApi();
      const session = pendingFile
        ? {
          supabaseUrl: getSupabaseUrl(),
          publishableKey: getSupabasePublishableKey(),
          accessToken: await getBrowserAccessToken(),
        }
        : null;
      const saved = await persistHomepageHero({
        pendingFile,
        currentStoragePath: storagePath,
        altText,
        updateSettings: (body) => client.updateAdminHomepageHeroSettings(body),
        storageSession: session,
      });
      clearPendingPreview();
      setStoragePath(saved?.storagePath || null);
      setAltText(saved?.altText || '');
      setMessage(saved?.storagePath
        ? 'Homepage hero published.'
        : 'Homepage uses the default salon image.');
    } catch (saveError) {
      setError(
        saveError instanceof ApiClientError
          ? saveError.message
          : explainHomepageHeroUploadError(saveError),
      );
    } finally {
      setPending(false);
    }
  }

  async function handleRestore() {
    if (pending || isDefaultHero) {
      return;
    }
    const confirmed = window.confirm(
      'Restore the default salon hero on the homepage? The current uploaded image will be removed after the default is published.',
    );
    if (!confirmed) {
      return;
    }
    setPending(true);
    setError('');
    setMessage('');
    try {
      const client = await createBrowserArtApi();
      const saved = await restoreHomepageHeroDefault({
        currentStoragePath: storagePath,
        altText,
        updateSettings: (body) => client.updateAdminHomepageHeroSettings(body),
        storageSession: isSupabaseConfigured()
          ? {
            supabaseUrl: getSupabaseUrl(),
            publishableKey: getSupabasePublishableKey(),
            accessToken: await getBrowserAccessToken(),
          }
          : {},
      });
      clearPendingPreview();
      setStoragePath(saved?.storagePath || null);
      setAltText(saved?.altText || '');
      setMessage('Default salon hero restored.');
    } catch (restoreError) {
      setError(
        restoreError instanceof ApiClientError
          ? restoreError.message
          : restoreError.message || 'The default hero could not be restored.',
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="space-y-8 max-w-xl" onSubmit={handleSubmit}>
      <ArtworkImageConstraintsStatus
        constraints={constraints}
        constraintsError={constraintsError}
        constraintsLoading={constraintsLoading}
        onRetry={retryConstraints}
      />

      <Field
        label="Hero image"
        hint="WebP, JPEG or PNG. Stored as settings/homepage/hero-{id}.{ext} in artwork-images."
        error={fileError}
      >
        <input
          className="field-input"
          type="file"
          accept={homepageHeroAcceptAttribute(constraints)}
          disabled={pickerBlocked || pending}
          onChange={onFileChange}
        />
      </Field>

      <div className="space-y-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={previewUrl}
          alt={altText.trim() || 'Homepage hero preview'}
          className="w-full max-h-80 object-cover object-center bg-surface-container-low"
        />
        <p className="text-sm text-on-surface-variant">{previewCaption}</p>
        {pendingFile ? (
          <button
            className="text-link"
            type="button"
            disabled={pending}
            onClick={() => {
              clearPendingPreview();
              setFileError('');
            }}
          >
            Discard selected image
          </button>
        ) : null}
      </div>

      <Field
        label="Alt text"
        hint={`Optional. Describes the banner for accessibility. At most ${HOMEPAGE_HERO_ALT_MAX_LENGTH} characters.`}
      >
        <input
          className="field-input"
          name="altText"
          maxLength={HOMEPAGE_HERO_ALT_MAX_LENGTH}
          placeholder="Maison d'Art salon interior"
          value={altText}
          disabled={pending}
          onChange={(event) => setAltText(event.target.value)}
        />
        <span className="block text-xs text-patina">{altText.length}/{HOMEPAGE_HERO_ALT_MAX_LENGTH}</span>
      </Field>

      <ActionStatus
        pending={pending}
        pendingLabel={pendingFile ? 'Publishing hero image' : 'Saving hero settings'}
        message={message}
        error={error}
      />

      <div className="flex flex-wrap gap-3">
        <button className="btn-primary" type="submit" {...pendingButtonProps(pending)}>
          {pending ? <ButtonLoader label="Saving" /> : 'Save / Publish'}
        </button>
        <button
          className="btn-secondary"
          type="button"
          onClick={handleRestore}
          {...pendingButtonProps(pending || isDefaultHero)}
        >
          Restore default
        </button>
      </div>
    </form>
  );
}
