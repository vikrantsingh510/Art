'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserArtApi, getBrowserAccessToken } from '@/lib/browser-api';
import { ApiClientError } from '@/lib/api-client';
import { rupeesToPaise, paiseToRupees } from '@/lib/money';
import { getSupabasePublishableKey, getSupabaseUrl, isSupabaseConfigured } from '@/lib/env';
import {
  explainStorageUploadError,
  isSelectedImageFile,
  validateArtworkImageFile,
} from '@/lib/artwork-image-constraints';
import { uploadArtworkImageFile } from '@/lib/artwork-image-upload';
import { ArtworkImageField } from './artwork-image-field';
import { ActionStatus, ButtonLoader } from './loading';
import { Field } from './ui';

const STATUSES = ['draft', 'published', 'reserved', 'sold', 'archived'];

export function ArtworkForm({ artwork, categories, collections, mode }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [uploadNote, setUploadNote] = useState('');
  const [savedArtworkId, setSavedArtworkId] = useState(artwork?.id || null);
  const [constraints, setConstraints] = useState(null);
  const [constraintsError, setConstraintsError] = useState('');
  const [constraintsLoading, setConstraintsLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState(null);
  const [progress, setProgress] = useState(null);
  const previewUrl = useMemo(
    () => (selectedFile ? URL.createObjectURL(selectedFile) : ''),
    [selectedFile],
  );
  const fileError = isSelectedImageFile(selectedFile)
    ? (validateArtworkImageFile(selectedFile, constraints).ok
      ? ''
      : validateArtworkImageFile(selectedFile, constraints).message)
    : '';

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

  useEffect(() => () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
  }, [previewUrl]);

  function onFileChange(file) {
    setSelectedFile(file);
    setUploadNote('');
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
    const rupees = formData.get('priceRupees');
    const body = {
      title: String(formData.get('title') || '').trim(),
      slug: String(formData.get('slug') || '').trim() || undefined,
      description: String(formData.get('description') || '').trim() || null,
      story: String(formData.get('story') || '').trim() || null,
      technique: String(formData.get('technique') || '').trim() || null,
      medium: String(formData.get('medium') || '').trim() || null,
      material: String(formData.get('material') || '').trim() || null,
      artistName: String(formData.get('artistName') || '').trim(),
      yearCreated: formData.get('yearCreated') ? Number(formData.get('yearCreated')) : null,
      width: String(formData.get('width') || '').trim() || null,
      height: String(formData.get('height') || '').trim() || null,
      depth: String(formData.get('depth') || '').trim() || null,
      dimensionUnit: String(formData.get('dimensionUnit') || '').trim() || null,
      pricePaise: rupeesToPaise(rupees),
      currency: 'INR',
      inventoryQuantity: formData.get('inventoryQuantity') ? Number(formData.get('inventoryQuantity')) : 1,
      status: String(formData.get('status') || 'draft'),
      isFeatured: formData.get('isFeatured') === 'on',
      categoryIds,
      collectionIds,
    };

    if (!body.title || !body.artistName || !Number.isFinite(Number(rupees))) {
      setError('Title, artist and a numeric INR price are required.');
      setPending(false);
      return;
    }

    const file = isSelectedImageFile(selectedFile) ? selectedFile : null;
    if (file) {
      const result = validateArtworkImageFile(file, constraints);
      if (!result.ok) {
        setError(result.message);
        setPending(false);
        return;
      }
    }

    try {
      const client = await createBrowserArtApi();
      const saved = savedArtworkId
        ? await client.updateArtwork(savedArtworkId, body)
        : await client.createArtwork(body);

      setSavedArtworkId(saved.id);
      if (typeof window !== 'undefined' && window.history?.replaceState) {
        window.history.replaceState(null, '', `/admin/artworks/${saved.id}/edit`);
      }

      if (file) {
        if (!isSupabaseConfigured()) {
          setUploadNote('Artwork saved, but image upload needs Supabase browser configuration.');
        } else {
          const accessToken = await getBrowserAccessToken();
          const path = `${saved.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
          try {
            setProgress(0);
            await uploadArtworkImageFile({
              supabaseUrl: getSupabaseUrl(),
              publishableKey: getSupabasePublishableKey(),
              accessToken,
              path,
              file,
              onProgress: setProgress,
            });
            await client.addArtworkImage(saved.id, {
              storagePath: path,
              altText: body.title,
              displayOrder: 0,
              isPrimary: true,
            });
            setUploadNote('Image uploaded to artwork-images and registered by path.');
          } catch (uploadError) {
            setUploadNote(explainStorageUploadError(uploadError));
            setPending(false);
            return;
          }
        }
      }

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
        <Field label="Artist / atelier">
          <input className="field-input" name="artistName" required defaultValue={artwork?.artistName || ''} />
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
          <Field label="Width"><input className="field-input" name="width" defaultValue={artwork?.width || ''} /></Field>
          <Field label="Height"><input className="field-input" name="height" defaultValue={artwork?.height || ''} /></Field>
          <Field label="Depth"><input className="field-input" name="depth" defaultValue={artwork?.depth || ''} /></Field>
          <Field label="Unit"><input className="field-input" name="dimensionUnit" defaultValue={artwork?.dimensionUnit || 'in'} /></Field>
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
          <select className="field-input" name="status" defaultValue={artwork?.status || 'draft'}>
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
        <Field label="Collections">
          <select className="field-input h-32" name="collectionIds" multiple defaultValue={artwork?.collectionIds || []}>
            {collections.map((collection) => (
              <option key={collection.id} value={collection.id}>{collection.name}</option>
            ))}
          </select>
        </Field>
      </section>

      <ArtworkImageField
        artwork={artwork}
        constraints={constraints}
        constraintsError={constraintsError}
        constraintsLoading={constraintsLoading}
        file={selectedFile}
        fileError={fileError}
        previewUrl={previewUrl}
        progress={progress}
        onFileChange={onFileChange}
      />

      <ActionStatus pending={pending} pendingLabel={savingLabel} message={uploadNote} error={error} />
      <button
        className="btn-primary"
        type="submit"
        disabled={
          pending
          || Boolean(fileError)
          || (isSelectedImageFile(selectedFile) && (constraintsLoading || !constraints))
        }
        aria-busy={pending}
      >
        {pending ? <ButtonLoader label={savingLabel} /> : savingLabel}
      </button>
    </form>
  );
}
