'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserArtApi, getBrowserAccessToken } from '@/lib/browser-api';
import { ApiClientError } from '@/lib/api-client';
import { useArtworkImageConstraints } from '@/lib/use-artwork-image-constraints';
import { collectionCoverStoragePath } from '@/lib/collection-cover';
import { getSupabasePublishableKey, getSupabaseUrl, isSupabaseConfigured } from '@/lib/env';
import { explainStorageUploadError } from '@/lib/artwork-image-constraints';
import { deleteArtworkImageFile, uploadArtworkImageFile } from '@/lib/artwork-image-upload';
import { pendingButtonProps } from '@/lib/pending-action';
import { CollectionArtworkPicker } from './collection-artwork-picker';
import { CollectionCoverUpload } from './collection-cover-upload';
import { ActionStatus, ButtonLoader } from './loading';
import { Field } from './ui';

function slugifyClient(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function fieldsFromCollection(collection) {
  return {
    name: collection?.name || '',
    slug: collection?.slug || '',
    description: collection?.description || '',
  };
}

export function CollectionForm({ collection = null, mode = 'create' }) {
  const router = useRouter();
  const [fields, setFields] = useState(() => fieldsFromCollection(collection));
  const [coverPath, setCoverPath] = useState(collection?.coverImagePath || null);
  const [coverUpdatedAt, setCoverUpdatedAt] = useState(collection?.updatedAt || null);
  const [pendingFile, setPendingFile] = useState(null);
  const [selectedArtworks, setSelectedArtworks] = useState(() => (collection?.artworks || []).map((item) => ({
    id: item.id,
    title: item.title,
    artistName: item.artistName,
    status: item.status,
    storagePath: item.storagePath,
  })));
  const [savedId, setSavedId] = useState(collection?.id || null);
  const [slugEdited, setSlugEdited] = useState(mode === 'edit');
  const [isPublished, setIsPublished] = useState(Boolean(collection?.isPublished));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [message, setMessage] = useState('');
  const {
    constraints,
    constraintsError,
    constraintsLoading,
    retryConstraints,
  } = useArtworkImageConstraints();

  function updateField(name, value) {
    if (name === 'slug') {
      setSlugEdited(true);
    }
    setFields((current) => {
      const next = { ...current, [name]: value };
      if (name === 'name' && !slugEdited) {
        next.slug = slugifyClient(value);
      }
      return next;
    });
  }

  async function persistCover(client, collectionId, currentPath) {
    if (!pendingFile) {
      return currentPath;
    }
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not configured for cover uploads.');
    }
    const path = collectionCoverStoragePath(collectionId, pendingFile.name);
    const session = {
      supabaseUrl: getSupabaseUrl(),
      publishableKey: getSupabasePublishableKey(),
      accessToken: await getBrowserAccessToken(),
    };
    if (currentPath && currentPath !== path) {
      try {
        await deleteArtworkImageFile({ ...session, path: currentPath });
      } catch {
        // Best-effort cleanup of a previous cover object.
      }
    }
    try {
      await deleteArtworkImageFile({ ...session, path });
    } catch {
      // Object may not exist yet.
    }
    try {
      await uploadArtworkImageFile({
        ...session,
        path,
        file: pendingFile,
      });
    } catch (uploadError) {
      throw new Error(uploadError?.message || explainStorageUploadError(uploadError));
    }
    const updated = await client.updateCollection(collectionId, { coverImagePath: path });
    const nextPath = updated?.coverImagePath || path;
    setPendingFile(null);
    setCoverPath(nextPath);
    setCoverUpdatedAt(updated?.updatedAt || new Date().toISOString());
    return {
      path: nextPath,
      updatedAt: updated?.updatedAt || null,
      collection: updated,
    };
  }

  async function persist(nextPublished) {
    setPending(true);
    setError('');
    setFieldErrors({});
    setMessage('');
    if (!fields.name.trim()) {
      setFieldErrors({ name: 'A name is required.' });
      setPending(false);
      return;
    }
    try {
      const client = await createBrowserArtApi();
      const payload = {
        name: fields.name.trim(),
        slug: fields.slug.trim() || undefined,
        description: fields.description.trim() || null,
        isPublished: nextPublished,
      };

      const hadPendingCover = Boolean(pendingFile);
      let current = null;
      if (savedId) {
        current = await client.updateCollection(savedId, payload);
      } else {
        current = await client.createCollection(payload);
        setSavedId(current.id);
      }

      let nextCoverPath = coverPath;
      let nextCoverUpdatedAt = coverUpdatedAt;
      if (hadPendingCover) {
        const uploaded = await persistCover(client, current.id, current.coverImagePath || coverPath);
        nextCoverPath = uploaded.path;
        nextCoverUpdatedAt = uploaded.updatedAt || nextCoverUpdatedAt;
        current = uploaded.collection || current;
      } else if (nextCoverPath !== (current.coverImagePath || null)) {
        current = await client.updateCollection(current.id, { coverImagePath: nextCoverPath });
        nextCoverPath = current.coverImagePath || nextCoverPath;
        nextCoverUpdatedAt = current.updatedAt || nextCoverUpdatedAt;
      }

      current = await client.replaceCollectionArtworks(
        current.id,
        selectedArtworks.map((item) => item.id),
      );

      setIsPublished(Boolean(current.isPublished));
      setCoverPath(hadPendingCover ? nextCoverPath : (current.coverImagePath || null));
      setCoverUpdatedAt(
        hadPendingCover
          ? (current.updatedAt || nextCoverUpdatedAt)
          : (current.updatedAt || null),
      );
      setSelectedArtworks((current.artworks || []).map((item) => ({
        id: item.id,
        title: item.title,
        artistName: item.artistName,
        status: item.status,
        storagePath: item.storagePath,
      })));
      setMessage(nextPublished ? 'Collection published.' : 'Draft saved.');
      const editHref = `/admin/collections/${current.id}/edit`;
      if (mode !== 'edit' || savedId !== current.id) {
        router.replace(editHref);
      }
      router.refresh();
    } catch (caught) {
      const details = caught instanceof ApiClientError ? caught.details : null;
      const nextFieldErrors = {};
      if (Array.isArray(details)) {
        details.forEach((detail) => {
          if (detail?.path && detail?.message) {
            nextFieldErrors[detail.path] = detail.message;
          }
        });
      }
      if (caught instanceof ApiClientError && caught.status === 409 && !nextFieldErrors.slug) {
        nextFieldErrors.slug = caught.message;
      }
      setFieldErrors(nextFieldErrors);
      setError(caught instanceof ApiClientError ? caught.message : caught.message);
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      className="space-y-10 max-w-3xl"
      onSubmit={(event) => {
        event.preventDefault();
        persist(isPublished);
      }}
    >
      <section className="space-y-5">
        <h2 className="font-display text-2xl">Hanging</h2>
        <Field label="Name" error={fieldErrors.name}>
          <input
            className="field-input"
            value={fields.name}
            maxLength={150}
            required
            onChange={(event) => updateField('name', event.target.value)}
          />
        </Field>
        <Field label="Slug" hint="Lowercase letters, numbers, and hyphens. Public URLs still use the collection UUID." error={fieldErrors.slug}>
          <input
            className="field-input"
            value={fields.slug}
            onChange={(event) => updateField('slug', event.target.value)}
          />
        </Field>
        <Field label="Description" error={fieldErrors.description}>
          <textarea
            className="field-input min-h-32"
            value={fields.description}
            onChange={(event) => updateField('description', event.target.value)}
          />
        </Field>
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            className="h-3.5 w-3.5 accent-charcoal"
            checked={isPublished}
            onChange={(event) => setIsPublished(event.target.checked)}
          />
          Published
        </label>
      </section>

      <section className="space-y-5">
        <h2 className="font-display text-2xl">Cover</h2>
        <CollectionCoverUpload
          key={`${coverPath || 'none'}::${coverUpdatedAt || 'new'}`}
          coverImagePath={coverPath}
          coverUpdatedAt={coverUpdatedAt}
          constraints={constraints}
          constraintsError={constraintsError}
          constraintsLoading={constraintsLoading}
          onRetryConstraints={retryConstraints}
          onPendingFile={setPendingFile}
          onRemove={() => {
            setPendingFile(null);
            setCoverPath(null);
          }}
        />
      </section>

      <section className="space-y-5">
        <h2 className="font-display text-2xl">Artworks</h2>
        <CollectionArtworkPicker selected={selectedArtworks} onChange={setSelectedArtworks} />
      </section>

      <ActionStatus pending={pending} pendingLabel="Saving collection" message={message} error={error} />

      <div className="flex flex-wrap gap-3">
        <button className="btn-primary" type="submit" {...pendingButtonProps(pending)}>
          {pending ? <ButtonLoader label="Saving" /> : 'Save collection'}
        </button>
        <button
          className="btn-secondary"
          type="button"
          {...pendingButtonProps(pending)}
          onClick={() => persist(true)}
        >
          {pending ? <ButtonLoader label="Publishing" /> : 'Save and publish'}
        </button>
        <a className="btn-secondary" href="/admin/collections">Cancel</a>
      </div>
    </form>
  );
}
