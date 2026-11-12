'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createBrowserArtApi, getBrowserAccessToken } from '@/lib/browser-api';
import { ApiClientError } from '@/lib/api-client';
import { artistPortraitStoragePath } from '@/lib/artist-portrait';
import { getSupabasePublishableKey, getSupabaseUrl, isSupabaseConfigured } from '@/lib/env';
import { explainStorageUploadError } from '@/lib/artwork-image-constraints';
import { deleteArtworkImageFile, uploadArtworkImageFile } from '@/lib/artwork-image-upload';
import { pendingButtonProps } from '@/lib/pending-action';
import { ArtistPortraitUpload } from './artist-portrait-upload';
import { ActionStatus, ButtonLoader } from './loading';
import { MarkdownBody } from './markdown-body';
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

function fieldsFromArtist(artist) {
  return {
    name: artist?.name || '',
    slug: artist?.slug || '',
    shortBio: artist?.shortBio || '',
    biography: artist?.biography || '',
    profileImageAlt: artist?.profileImageAlt || '',
    artisticStyle: artist?.artisticStyle || '',
    medium: artist?.medium || '',
    location: artist?.location || '',
    seoTitle: artist?.seoTitle || '',
    seoDescription: artist?.seoDescription || '',
  };
}

export function ArtistForm({ artist = null, mode = 'create' }) {
  const router = useRouter();
  const [fields, setFields] = useState(() => fieldsFromArtist(artist));
  const [portraitPath, setPortraitPath] = useState(artist?.profileImagePath || null);
  const [pendingFile, setPendingFile] = useState(null);
  const [savedId, setSavedId] = useState(artist?.id || null);
  const [status, setStatus] = useState(artist?.status || 'draft');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [constraints, setConstraints] = useState(null);
  const associated = Array.isArray(artist?.artworks) ? artist.artworks : [];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const client = await createBrowserArtApi();
        const data = await client.adminArtworkImageConstraints();
        if (!cancelled) {
          setConstraints(data);
        }
      } catch {
        if (!cancelled) {
          setConstraints(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function updateField(name, value) {
    setFields((current) => {
      const next = { ...current, [name]: value };
      if (name === 'name' && mode === 'create' && !current.slug) {
        next.slug = slugifyClient(value);
      }
      return next;
    });
  }

  async function persistPortrait(client, artistId, currentPath) {
    if (!pendingFile) {
      return currentPath;
    }
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not configured for portrait uploads.');
    }
    const path = artistPortraitStoragePath(artistId, pendingFile.name);
    const session = {
      supabaseUrl: getSupabaseUrl(),
      publishableKey: getSupabasePublishableKey(),
      accessToken: await getBrowserAccessToken(),
    };
    if (currentPath && currentPath !== path) {
      try {
        await deleteArtworkImageFile({ ...session, path: currentPath });
      } catch {
        // Best-effort cleanup of a previous portrait object.
      }
    }
    try {
      await deleteArtworkImageFile({ ...session, path });
    } catch {
      // Object may not exist yet; x-upsert is false so a leftover same-path object would 409.
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
    await client.updateArtist(artistId, {
      profileImagePath: path,
      profileImageAlt: fields.profileImageAlt || null,
    });
    setPendingFile(null);
    setPortraitPath(path);
    return path;
  }

  async function persist(nextStatus) {
    setPending(true);
    setError('');
    setMessage('');
    try {
      const client = await createBrowserArtApi();
      const payload = {
        name: fields.name,
        slug: fields.slug || undefined,
        shortBio: fields.shortBio || null,
        biography: fields.biography || null,
        profileImageAlt: fields.profileImageAlt || null,
        artisticStyle: fields.artisticStyle || null,
        medium: fields.medium || null,
        location: fields.location || null,
        seoTitle: fields.seoTitle || null,
        seoDescription: fields.seoDescription || null,
        status: nextStatus,
      };

      let current = savedId
        ? await client.updateArtist(savedId, payload)
        : await client.createArtist(payload);
      setSavedId(current.id);

      const nextPath = pendingFile
        ? await persistPortrait(client, current.id, current.profileImagePath || portraitPath)
        : portraitPath;
      if (!pendingFile && nextPath !== (current.profileImagePath || null)) {
        current = await client.updateArtist(current.id, {
          profileImagePath: nextPath,
          profileImageAlt: fields.profileImageAlt || null,
        });
      }

      setStatus(current.status);
      setPortraitPath(current.profileImagePath || null);
      setMessage(nextStatus === 'published' ? 'Published to Artists.' : 'Draft saved.');
      router.replace(`/admin/artists/${current.id}/edit`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : caught.message);
    } finally {
      setPending(false);
    }
  }

  async function unpublish() {
    setPending(true);
    setError('');
    try {
      const client = await createBrowserArtApi();
      const current = await client.updateArtist(savedId, { status: 'draft' });
      setStatus(current.status);
      setMessage('Unpublished. The first published date is preserved.');
      router.refresh();
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : caught.message);
    } finally {
      setPending(false);
    }
  }

  async function remove() {
    const confirmed = window.confirm('Delete this artist permanently? Associated artworks keep their artist name and lose the profile link.');
    if (!confirmed || !savedId) {
      return;
    }
    setPending(true);
    setError('');
    try {
      if (portraitPath && isSupabaseConfigured()) {
        try {
          await deleteArtworkImageFile({
            supabaseUrl: getSupabaseUrl(),
            publishableKey: getSupabasePublishableKey(),
            accessToken: await getBrowserAccessToken(),
            path: portraitPath,
          });
        } catch {
          // Catalogue delete still proceeds if Storage cleanup fails.
        }
      }
      const client = await createBrowserArtApi();
      await client.deleteArtist(savedId);
      router.push('/admin/artists');
      router.refresh();
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : caught.message);
      setPending(false);
    }
  }

  async function clearPortrait() {
    setPendingFile(null);
    if (!portraitPath) {
      return;
    }
    if (savedId && isSupabaseConfigured()) {
      try {
        await deleteArtworkImageFile({
          supabaseUrl: getSupabaseUrl(),
          publishableKey: getSupabasePublishableKey(),
          accessToken: await getBrowserAccessToken(),
          path: portraitPath,
        });
      } catch {
        // Path is still cleared on the catalogue row.
      }
      const client = await createBrowserArtApi();
      await client.updateArtist(savedId, { profileImagePath: null });
    }
    setPortraitPath(null);
  }

  return (
    <form className="space-y-10" onSubmit={(event) => event.preventDefault()}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="space-y-6">
          <Field label="Name">
            <input className="field-input" value={fields.name} onChange={(event) => updateField('name', event.target.value)} required />
          </Field>
          <Field label="Slug" hint="Changing the slug does not create a redirect. The previous URL will 404.">
            <input className="field-input" value={fields.slug} onChange={(event) => updateField('slug', event.target.value)} />
          </Field>
          <Field label="Short biography">
            <textarea className="field-input min-h-24" value={fields.shortBio} onChange={(event) => updateField('shortBio', event.target.value)} />
          </Field>
          <Field label="Biography" hint="Markdown: paragraphs, ## / ### headings, **bold**, *italic*, lists, and https/mailto links. Raw HTML is escaped.">
            <textarea
              className="field-input min-h-64 font-mono text-sm"
              value={fields.biography}
              onChange={(event) => updateField('biography', event.target.value)}
            />
          </Field>
        </div>
        <div className="space-y-6">
          <Field label="Artistic style">
            <input className="field-input" value={fields.artisticStyle} onChange={(event) => updateField('artisticStyle', event.target.value)} />
          </Field>
          <Field label="Medium">
            <input className="field-input" value={fields.medium} onChange={(event) => updateField('medium', event.target.value)} />
          </Field>
          <Field label="Location">
            <input className="field-input" value={fields.location} onChange={(event) => updateField('location', event.target.value)} />
          </Field>
          <Field label="SEO title">
            <input className="field-input" value={fields.seoTitle} onChange={(event) => updateField('seoTitle', event.target.value)} />
          </Field>
          <Field label="SEO description">
            <textarea className="field-input min-h-24" value={fields.seoDescription} onChange={(event) => updateField('seoDescription', event.target.value)} />
          </Field>
          <ArtistPortraitUpload
            profileImagePath={portraitPath}
            profileImageAlt={fields.profileImageAlt}
            constraints={constraints}
            onPendingFile={setPendingFile}
            onAltChange={(value) => updateField('profileImageAlt', value)}
            onRemove={clearPortrait}
          />
          <p className="label-sm text-patina">Status: {status}</p>
        </div>
      </div>
      {associated.length > 0 ? (
        <div className="space-y-3">
          <p className="label-md text-patina">Associated artworks</p>
          <ul className="space-y-2">
            {associated.map((item) => (
              <li key={item.id} className="flex justify-between gap-4 border-b border-fillet py-2">
                <span>{item.title} · {item.status}</span>
                <Link className="text-link" href={`/admin/artworks/${item.id}/edit`}>Edit lot</Link>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-on-surface-variant">No artworks are linked to this artist yet.</p>
      )}
      <div>
        <p className="label-md text-patina mb-3">Biography preview</p>
        <MarkdownBody markdown={fields.biography} />
      </div>
      <ActionStatus pending={pending} pendingLabel="Saving artist" message={message} error={error} />
      <div className="flex flex-wrap gap-3">
        <button className="btn-secondary" type="button" {...pendingButtonProps(pending)} onClick={() => persist('draft')}>
          {pending ? <ButtonLoader label="Saving" /> : 'Save draft'}
        </button>
        <button className="btn-primary" type="button" {...pendingButtonProps(pending)} onClick={() => persist('published')}>
          {pending ? <ButtonLoader label="Publishing" /> : 'Publish'}
        </button>
        {savedId && status === 'published' ? (
          <button className="btn-secondary" type="button" {...pendingButtonProps(pending)} onClick={unpublish}>
            Unpublish
          </button>
        ) : null}
        {savedId ? (
          <button className="btn-secondary" type="button" {...pendingButtonProps(pending)} onClick={remove}>
            Delete
          </button>
        ) : null}
      </div>
    </form>
  );
}
