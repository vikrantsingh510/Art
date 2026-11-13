'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserArtApi, getBrowserAccessToken } from '@/lib/browser-api';
import { ApiClientError } from '@/lib/api-client';
import { rupeesToPaise, paiseToRupees } from '@/lib/money';
import { getSupabasePublishableKey, getSupabaseUrl, isSupabaseConfigured } from '@/lib/env';
import { validateArtworkImageFile } from '@/lib/artwork-image-constraints';
import { inspectArtworkImageFile } from '@/lib/artwork-image-inspect';
import { explainImagePersistError, persistArtworkDisplayDerivative, persistPendingArtworkImage, purgeCatalogueImage } from '@/lib/artwork-image-upload';
import {
  ArtworkImageManager,
  createManagerItems,
  managerHasBlockingError,
} from './artwork-image-manager';
import { ArtworkArReadiness } from './artwork-ar-readiness';
import { ActionStatus, ButtonLoader } from './loading';
import { Field } from './ui';

const STATUSES = ['draft', 'published', 'reserved', 'sold', 'archived'];

function sanitizeFileName(name) {
  return String(name || 'image').replace(/[^a-zA-Z0-9._-]/g, '_');
}

async function createAdminDisplayDerivative(file, accessToken) {
  const body = new FormData();
  body.append('file', file);
  const response = await fetch('/api/admin/artwork-display', {
    method: 'POST',
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    body,
  });
  if (!response.ok) {
    return null;
  }
  const blob = await response.blob();
  if (!blob?.size) {
    return null;
  }
  return new File([blob], 'display.webp', { type: 'image/webp' });
}

export function ArtworkForm({ artwork, categories, collections, artists = [], mode }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [uploadNote, setUploadNote] = useState('');
  const [savedArtworkId, setSavedArtworkId] = useState(artwork?.id || null);
  const [constraints, setConstraints] = useState(null);
  const [constraintsError, setConstraintsError] = useState('');
  const [constraintsLoading, setConstraintsLoading] = useState(true);
  const [imageItems, setImageItems] = useState(() => createManagerItems(artwork));
  const [progress, setProgress] = useState(null);
  const [physicalDraft, setPhysicalDraft] = useState({
    width: artwork?.width || '',
    height: artwork?.height || '',
    depth: artwork?.depth || '',
    dimensionUnit: artwork?.dimensionUnit || 'in',
    status: artwork?.status || 'draft',
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const client = await createBrowserArtApi();
        const data = await client.adminArtworkImageConstraints();
        if (!cancelled) {
          setConstraints(data);
          setConstraintsError('');
        }
      } catch (caught) {
        if (!cancelled) {
          setConstraints(null);
          setConstraintsError(caught instanceof ApiClientError
            ? caught.message
            : 'Upload limits could not be loaded from the artwork-images bucket.');
        }
      } finally {
        if (!cancelled) {
          setConstraintsLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function persistImages(client, artworkId) {
    const original = createManagerItems(artwork);
    const remainingSavedIds = new Set(
      imageItems.filter((item) => item.kind === 'saved').map((item) => item.id),
    );
    const removed = original.filter((item) => !remainingSavedIds.has(item.id));
    const notes = [];

    for (const item of removed) {
      const accessToken = await getBrowserAccessToken();
      await purgeCatalogueImage({
        storagePath: item.storagePath,
        storageSession: {
          supabaseUrl: getSupabaseUrl(),
          publishableKey: getSupabasePublishableKey(),
          accessToken,
        },
        removeCatalogue: () => client.removeArtworkImage(artworkId, item.id),
      });
    }

    const registered = [];
    const pendingItems = imageItems.filter((item) => item.kind === 'pending');
    for (const [index, item] of pendingItems.entries()) {
      const inspection = await inspectArtworkImageFile(item.file);
      const validation = validateArtworkImageFile(item.file, constraints, inspection);
      if (!validation.ok) {
        throw new Error(validation.message);
      }
      if (!isSupabaseConfigured()) {
        throw new Error('Artwork saved, but image upload needs Supabase browser configuration.');
      }
      const accessToken = await getBrowserAccessToken();
      const path = `${artworkId}/${Date.now()}-${index}-${sanitizeFileName(item.file.name)}`;
      setImageItems((current) => current.map((entry) => (
        entry.key === item.key ? { ...entry, progress: 0 } : entry
      )));
      const storageSession = {
        supabaseUrl: getSupabaseUrl(),
        publishableKey: getSupabasePublishableKey(),
        accessToken,
      };
      const created = await persistPendingArtworkImage({
        storageSession,
        artworkId,
        path,
        file: item.file,
        onProgress: (value) => {
          setProgress(value);
          setImageItems((current) => current.map((entry) => (
            entry.key === item.key ? { ...entry, progress: value } : entry
          )));
        },
        registerCatalogue: () => client.addArtworkImage(artworkId, {
          storagePath: path,
          altText: item.label || artwork?.title || null,
          isPrimary: Boolean(item.isPrimary),
          mimeType: item.file.type || null,
          fileSizeBytes: item.file.size,
        }),
      });
      registered.push({ key: item.key, id: created.id });
      await persistArtworkDisplayDerivative({
        originalPath: path,
        file: item.file,
        storageSession,
        createDerivative: (source) => createAdminDisplayDerivative(source, accessToken),
      });
    }

    const orderKeys = imageItems.map((item) => {
      if (item.kind === 'saved') {
        return item.id;
      }
      return registered.find((entry) => entry.key === item.key)?.id;
    }).filter(Boolean);

    const primaryItem = imageItems.find((item) => item.isPrimary);
    let primaryImageId = null;
    if (primaryItem?.kind === 'saved') {
      primaryImageId = primaryItem.id;
    } else if (primaryItem) {
      primaryImageId = registered.find((entry) => entry.key === primaryItem.key)?.id || null;
    }

    if (orderKeys.length > 0) {
      await client.reorderArtworkImages(artworkId, {
        imageIds: orderKeys,
        primaryImageId,
      });
    }

    return notes;
  }

  async function onSubmit(event) {
    event.preventDefault();
    setPending(true);
    setError('');
    setUploadNote('');
    setProgress(null);
    const form = event.currentTarget;
    const formData = new FormData(form);
    const categoryIds = formData.getAll('categoryIds').filter(Boolean);
    const collectionIds = formData.getAll('collectionIds').filter(Boolean);
    const originalCollectionIds = [...(artwork?.collectionIds || [])];
    const collectionMembershipUnchanged = originalCollectionIds.length === collectionIds.length
      && originalCollectionIds.every((id) => collectionIds.includes(id));
    const rupees = formData.get('priceRupees');
    const intendedStatus = String(formData.get('status') || 'draft');
    const artistId = String(formData.get('artistId') || '').trim() || null;
    const body = {
      title: String(formData.get('title') || '').trim(),
      slug: String(formData.get('slug') || '').trim() || undefined,
      description: String(formData.get('description') || '').trim() || null,
      story: String(formData.get('story') || '').trim() || null,
      technique: String(formData.get('technique') || '').trim() || null,
      medium: String(formData.get('medium') || '').trim() || null,
      material: String(formData.get('material') || '').trim() || null,
      artistId,
      ...(artistId ? {} : { artistName: artwork?.artistName || undefined }),
      yearCreated: formData.get('yearCreated') ? Number(formData.get('yearCreated')) : null,
      width: String(formData.get('width') || '').trim() || null,
      height: String(formData.get('height') || '').trim() || null,
      depth: String(formData.get('depth') || '').trim() || null,
      dimensionUnit: String(formData.get('dimensionUnit') || '').trim() || null,
      pricePaise: rupeesToPaise(rupees),
      currency: 'INR',
      inventoryQuantity: formData.get('inventoryQuantity') ? Number(formData.get('inventoryQuantity')) : 1,
      status: intendedStatus,
      isFeatured: formData.get('isFeatured') === 'on',
      categoryIds,
    };
    const shouldWriteCollections = !savedArtworkId
      ? true
      : collections.length > 0 && !collectionMembershipUnchanged;
    if (shouldWriteCollections) {
      body.collectionIds = collectionIds;
    }

    if (!body.title || (!body.artistId && !body.artistName) || !Number.isFinite(Number(rupees))) {
      setError('Title, a published artist and a numeric INR price are required.');
      setPending(false);
      return;
    }

    if (managerHasBlockingError(imageItems, constraints)) {
      setError('One or more selected images are outside the artwork-images bucket limits.');
      setPending(false);
      return;
    }

    const pendingCount = imageItems.filter((item) => item.kind === 'pending').length;
    const savedCount = imageItems.filter((item) => item.kind === 'saved').length;
    if (intendedStatus === 'published' && savedCount + pendingCount === 0) {
      setError('An artwork must have at least one catalogue image before it can be published.');
      setPending(false);
      return;
    }

    try {
      const client = await createBrowserArtApi();
      let saved;
      let notes = [];
      if (savedArtworkId) {
        try {
          notes = await persistImages(client, savedArtworkId);
        } catch (uploadError) {
          setUploadNote(explainImagePersistError(uploadError));
          setPending(false);
          return;
        }
        saved = await client.updateArtwork(savedArtworkId, body);
      } else {
        saved = await client.createArtwork({
          ...body,
          status: intendedStatus === 'published' ? 'draft' : intendedStatus,
        });
        setSavedArtworkId(saved.id);
        if (typeof window !== 'undefined' && window.history?.replaceState) {
          window.history.replaceState(null, '', `/admin/artworks/${saved.id}/edit`);
        }
        try {
          notes = await persistImages(client, saved.id);
        } catch (uploadError) {
          setUploadNote(explainImagePersistError(uploadError));
          setPending(false);
          return;
        }
        if (intendedStatus === 'published') {
          saved = await client.updateArtwork(saved.id, { status: 'published' });
        }
      }

      imageItems
        .filter((item) => item.kind === 'pending' && item.previewUrl)
        .forEach((item) => URL.revokeObjectURL(item.previewUrl));
      setImageItems(createManagerItems(saved));
      setProgress(null);
      setPending(false);
      setUploadNote(notes[0] || (pendingCount > 0 ? 'Images uploaded to artwork-images and registered by path.' : ''));
      router.push(`/admin/artworks/${saved.id}/edit`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : caught.message);
      setPending(false);
    }
  }

  const savingLabel = pending
    ? (progress === null ? 'Saving…' : `Uploading image… ${progress}%`)
    : (savedArtworkId || mode === 'edit' ? 'Save artwork' : 'Create artwork');

  return (
    <form className="space-y-8 max-w-3xl" onSubmit={onSubmit}>
      <section className="space-y-5">
        <h2 className="font-display text-2xl">Identification</h2>
        <Field label="Artwork title">
          <input className="field-input" name="title" required defaultValue={artwork?.title || ''} />
        </Field>
        <Field label="Slug" hint="Optional. Public detail lookup remains UUID-only.">
          <input className="field-input" name="slug" defaultValue={artwork?.slug || ''} />
        </Field>
        <Field
          label="Artist"
          hint={artwork?.artistId ? 'Renaming the artist in Artists updates this lot’s displayed name.' : 'Unresolved lots keep their original artist name until a published artist is selected.'}
        >
          <select className="field-input" name="artistId" defaultValue={artwork?.artistId || ''} required={mode === 'create'}>
            <option value="">{artwork?.artistName && !artwork?.artistId ? `Unassigned — ${artwork.artistName}` : 'Select a published artist'}</option>
            {artists
              .filter((item) => item.status === 'published' || item.id === artwork?.artistId)
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}{item.status !== 'published' ? ' (draft)' : ''}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Year">
          <input className="field-input" name="yearCreated" type="number" min="1000" max="9999" defaultValue={artwork?.yearCreated || ''} />
        </Field>
      </section>

      <section className="space-y-5">
        <h2 className="font-display text-2xl">Material ledger</h2>
        <Field label="Medium"><input className="field-input" name="medium" defaultValue={artwork?.medium || ''} /></Field>
        <Field label="Material"><input className="field-input" name="material" defaultValue={artwork?.material || ''} /></Field>
        <Field label="Technique"><input className="field-input" name="technique" defaultValue={artwork?.technique || ''} /></Field>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Field label="Width">
            <input
              className="field-input"
              name="width"
              defaultValue={artwork?.width || ''}
              onChange={(event) => setPhysicalDraft((current) => ({ ...current, width: event.target.value }))}
            />
          </Field>
          <Field label="Height">
            <input
              className="field-input"
              name="height"
              defaultValue={artwork?.height || ''}
              onChange={(event) => setPhysicalDraft((current) => ({ ...current, height: event.target.value }))}
            />
          </Field>
          <Field label="Depth">
            <input
              className="field-input"
              name="depth"
              defaultValue={artwork?.depth || ''}
              onChange={(event) => setPhysicalDraft((current) => ({ ...current, depth: event.target.value }))}
            />
          </Field>
          <Field label="Unit" hint="mm, cm or in. Never inferred from the image.">
            <input
              className="field-input"
              name="dimensionUnit"
              defaultValue={artwork?.dimensionUnit || 'in'}
              onChange={(event) => setPhysicalDraft((current) => ({ ...current, dimensionUnit: event.target.value }))}
            />
          </Field>
        </div>
      </section>

      <section className="space-y-5">
        <h2 className="font-display text-2xl">Monograph</h2>
        <Field label="Description">
          <textarea className="field-input" name="description" rows={4} defaultValue={artwork?.description || ''} />
        </Field>
        <Field label="Story">
          <textarea className="field-input" name="story" rows={6} defaultValue={artwork?.story || ''} />
        </Field>
      </section>

      <section className="space-y-5">
        <h2 className="font-display text-2xl">Acquisition</h2>
        <Field label="Price (INR rupees)" hint="Converted to integer paise before POST/PATCH.">
          <input className="field-input" name="priceRupees" type="number" min="0" step="1" required defaultValue={artwork ? paiseToRupees(artwork.pricePaise) : ''} />
        </Field>
        <Field label="Inventory quantity">
          <input className="field-input" name="inventoryQuantity" type="number" min="0" defaultValue={artwork?.inventoryQuantity ?? 1} />
        </Field>
        <Field label="Status">
          <select
            className="field-input"
            name="status"
            defaultValue={artwork?.status || 'draft'}
            onChange={(event) => setPhysicalDraft((current) => ({ ...current, status: event.target.value }))}
          >
            {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </Field>
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" name="isFeatured" defaultChecked={Boolean(artwork?.isFeatured)} className="h-3.5 w-3.5 accent-charcoal" />
          Featured on the exhibition
        </label>
      </section>

      <section className="space-y-5">
        <h2 className="font-display text-2xl">Taxonomy</h2>
        <Field label="Categories">
          <select className="field-input h-32" name="categoryIds" multiple defaultValue={artwork?.categoryIds || []}>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </Field>
        <Field
          label="Collections"
          hint={collections.length === 0
            ? 'Create a hanging under Collections before assigning this lot. Existing memberships are left unchanged while this list is empty.'
            : 'Hold Ctrl or Cmd to select more than one hanging. Saving without a change leaves memberships intact.'}
        >
          <select className="field-input h-32" name="collectionIds" multiple defaultValue={artwork?.collectionIds || []}>
            {collections.map((collection) => (
              <option key={collection.id} value={collection.id}>{collection.name}</option>
            ))}
          </select>
        </Field>
      </section>

      <ArtworkImageManager
        constraints={constraints}
        constraintsError={constraintsError}
        constraintsLoading={constraintsLoading}
        disabled={pending}
        items={imageItems}
        onItemsChange={setImageItems}
      />

      <ArtworkArReadiness
        artworkId={savedArtworkId}
        title={artwork?.title || ''}
        status={physicalDraft.status}
        width={physicalDraft.width}
        height={physicalDraft.height}
        depth={physicalDraft.depth}
        unit={physicalDraft.dimensionUnit}
        primaryItem={imageItems.find((item) => item.isPrimary) || imageItems[0] || null}
      />

      <ActionStatus pending={pending} pendingLabel={savingLabel} message={uploadNote} error={error} />
      <button
        className="btn-primary"
        type="submit"
        disabled={pending || managerHasBlockingError(imageItems, constraints)}
        aria-busy={pending}
      >
        {pending ? <ButtonLoader label={savingLabel} /> : savingLabel}
      </button>
    </form>
  );
}
