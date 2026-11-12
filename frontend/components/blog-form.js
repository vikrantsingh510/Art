'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserArtApi, getBrowserAccessToken } from '@/lib/browser-api';
import { ApiClientError } from '@/lib/api-client';
import { blogCoverStoragePath } from '@/lib/blog-cover';
import { getSupabasePublishableKey, getSupabaseUrl, isSupabaseConfigured } from '@/lib/env';
import { explainStorageUploadError } from '@/lib/artwork-image-constraints';
import { deleteArtworkImageFile, uploadArtworkImageFile } from '@/lib/artwork-image-upload';
import { pendingButtonProps } from '@/lib/pending-action';
import { BlogArtworkPicker } from './blog-artwork-picker';
import { BlogCoverUpload } from './blog-cover-upload';
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

function fieldsFromBlog(blog) {
  return {
    title: blog?.title || '',
    slug: blog?.slug || '',
    excerpt: blog?.excerpt || '',
    body: blog?.body || '',
    coverAltText: blog?.coverAltText || '',
    seoTitle: blog?.seoTitle || '',
    seoDescription: blog?.seoDescription || '',
  };
}

export function BlogForm({ blog = null, mode = 'create' }) {
  const router = useRouter();
  const [fields, setFields] = useState(() => fieldsFromBlog(blog));
  const [coverPath, setCoverPath] = useState(blog?.coverImagePath || null);
  const [pendingFile, setPendingFile] = useState(null);
  const [selectedArtworks, setSelectedArtworks] = useState(() => (blog?.artworks || []).map((item) => ({
    id: item.id,
    title: item.title,
    artistName: item.artistName,
  })));
  const [savedId, setSavedId] = useState(blog?.id || null);
  const [status, setStatus] = useState(blog?.status || 'draft');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [constraints, setConstraints] = useState(null);

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
      if (name === 'title' && mode === 'create' && !current.slug) {
        next.slug = slugifyClient(value);
      }
      return next;
    });
  }

  async function persistCover(client, blogId, currentPath) {
    if (!pendingFile) {
      return currentPath;
    }
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not configured for cover uploads.');
    }
    const path = blogCoverStoragePath(blogId, pendingFile.name);
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
    await client.updateBlog(blogId, {
      coverImagePath: path,
      coverAltText: fields.coverAltText || null,
    });
    setPendingFile(null);
    setCoverPath(path);
    return path;
  }

  async function persist(nextStatus) {
    setPending(true);
    setError('');
    setMessage('');
    try {
      const client = await createBrowserArtApi();
      const payload = {
        title: fields.title,
        slug: fields.slug || undefined,
        excerpt: fields.excerpt || null,
        body: fields.body,
        coverAltText: fields.coverAltText || null,
        seoTitle: fields.seoTitle || null,
        seoDescription: fields.seoDescription || null,
        status: nextStatus,
      };

      let current = null;
      if (savedId) {
        current = await client.updateBlog(savedId, payload);
      } else {
        current = await client.createBlog(payload);
        setSavedId(current.id);
      }

      const nextPath = pendingFile
        ? await persistCover(client, current.id, current.coverImagePath || coverPath)
        : coverPath;
      if (!pendingFile && nextPath !== (current.coverImagePath || null)) {
        current = await client.updateBlog(current.id, {
          coverImagePath: nextPath,
          coverAltText: fields.coverAltText || null,
        });
      }

      current = await client.replaceBlogArtworks(
        current.id,
        selectedArtworks.map((item) => item.id),
      );

      setStatus(current.status);
      setCoverPath(current.coverImagePath || null);
      setMessage(nextStatus === 'published' ? 'Published to Journal.' : 'Draft saved.');
      router.replace(`/admin/blogs/${current.id}/edit`);
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
      const current = await client.updateBlog(savedId, { status: 'draft' });
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
    const confirmed = window.confirm('Delete this journal entry permanently? This cannot be undone.');
    if (!confirmed || !savedId) {
      return;
    }
    setPending(true);
    setError('');
    try {
      if (coverPath && isSupabaseConfigured()) {
        try {
          await deleteArtworkImageFile({
            supabaseUrl: getSupabaseUrl(),
            publishableKey: getSupabasePublishableKey(),
            accessToken: await getBrowserAccessToken(),
            path: coverPath,
          });
        } catch {
          // Catalogue delete still proceeds if Storage cleanup fails.
        }
      }
      const client = await createBrowserArtApi();
      await client.deleteBlog(savedId);
      router.push('/admin/blogs');
      router.refresh();
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : caught.message);
      setPending(false);
    }
  }

  async function clearCover() {
    setPendingFile(null);
    if (!coverPath) {
      return;
    }
    if (savedId && isSupabaseConfigured()) {
      try {
        await deleteArtworkImageFile({
          supabaseUrl: getSupabaseUrl(),
          publishableKey: getSupabasePublishableKey(),
          accessToken: await getBrowserAccessToken(),
          path: coverPath,
        });
      } catch {
        // Path is still cleared on the catalogue row.
      }
      const client = await createBrowserArtApi();
      await client.updateBlog(savedId, { coverImagePath: null });
    }
    setCoverPath(null);
  }

  return (
    <form className="space-y-10" onSubmit={(event) => event.preventDefault()}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="space-y-6">
          <Field label="Title">
            <input className="field-input" value={fields.title} onChange={(event) => updateField('title', event.target.value)} required />
          </Field>
          <Field label="Slug" hint="Changing the slug does not create a redirect. The previous URL will 404.">
            <input className="field-input" value={fields.slug} onChange={(event) => updateField('slug', event.target.value)} />
          </Field>
          <Field label="Excerpt">
            <textarea className="field-input min-h-24" value={fields.excerpt} onChange={(event) => updateField('excerpt', event.target.value)} />
          </Field>
          <Field label="Body" hint="Markdown: paragraphs, ## / ### headings, **bold**, *italic*, lists, and https/mailto links. Raw HTML is escaped.">
            <textarea
              className="field-input min-h-64 font-mono text-sm"
              value={fields.body}
              onChange={(event) => updateField('body', event.target.value)}
            />
          </Field>
        </div>
        <div className="space-y-6">
          <Field label="SEO title">
            <input className="field-input" value={fields.seoTitle} onChange={(event) => updateField('seoTitle', event.target.value)} />
          </Field>
          <Field label="SEO description">
            <textarea className="field-input min-h-24" value={fields.seoDescription} onChange={(event) => updateField('seoDescription', event.target.value)} />
          </Field>
          <BlogCoverUpload
            coverImagePath={coverPath}
            coverAltText={fields.coverAltText}
            constraints={constraints}
            onPendingFile={setPendingFile}
            onAltChange={(value) => updateField('coverAltText', value)}
            onRemove={clearCover}
          />
          <p className="label-sm text-patina">Status: {status}</p>
        </div>
      </div>
      <BlogArtworkPicker selected={selectedArtworks} onChange={setSelectedArtworks} />
      <div>
        <p className="label-md text-patina mb-3">Preview</p>
        <MarkdownBody markdown={fields.body} />
      </div>
      <ActionStatus pending={pending} pendingLabel="Saving journal entry" message={message} error={error} />
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
