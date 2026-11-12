'use client';

import { useEffect, useMemo, useState } from 'react';
import { describeAdminArReadiness } from '@/lib/ar-assets/admin-preview';
import { getBrowserAccessToken } from '@/lib/browser-api';

function formatPct(value) {
  if (value == null || !Number.isFinite(Number(value))) {
    return '—';
  }
  return `${Number(value).toFixed(2)}%`;
}

async function measureUrlPixels(url) {
  if (!url || typeof window === 'undefined') {
    return null;
  }
  return new Promise((resolve) => {
    const image = new window.Image();
    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

export function ArtworkArReadiness({
  artworkId,
  title,
  status,
  width,
  height,
  depth,
  unit,
  primaryItem,
}) {
  const [urlMeasure, setUrlMeasure] = useState({ url: null, size: null });
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [generation, setGeneration] = useState(null);

  const pixelWidth = Number(primaryItem?.pixelWidth) || 0;
  const pixelHeight = Number(primaryItem?.pixelHeight) || 0;
  const pendingPixels = pixelWidth > 0 && pixelHeight > 0
    ? { width: pixelWidth, height: pixelHeight }
    : null;
  const previewUrl = pendingPixels ? null : (primaryItem?.previewUrl || null);

  useEffect(() => {
    if (!previewUrl) {
      return undefined;
    }
    let cancelled = false;
    measureUrlPixels(previewUrl).then((size) => {
      if (!cancelled) {
        setUrlMeasure({ url: previewUrl, size });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [previewUrl]);

  const urlPixels = urlMeasure.url === previewUrl ? urlMeasure.size : null;
  const pixels = pendingPixels || urlPixels;
  const imageKind = primaryItem?.imageKind || null;
  const imageOk = primaryItem?.imageOk !== false || Boolean(pixels);

  const preview = useMemo(() => describeAdminArReadiness({
    width,
    height,
    depth,
    unit,
    dimensionUnit: unit,
    status,
    pixels,
    imageKind,
    imageOk: primaryItem ? imageOk : false,
  }), [width, height, depth, unit, status, pixels, imageKind, imageOk, primaryItem]);

  async function postAr(path, body) {
    const token = await getBrowserAccessToken();
    if (!token) {
      throw new Error('Sign in as an administrator to generate or publish AR assets.');
    }
    const response = await fetch(path, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok && !payload.error) {
      throw new Error(payload.message || `AR request failed (${response.status}).`);
    }
    return payload;
  }

  async function onGenerate() {
    setBusy('generate');
    setError('');
    setMessage('');
    setGeneration(null);
    try {
      const payload = await postAr('/api/admin/ar/generate', { artworkId });
      if (!payload.ok) {
        setError(payload.error || 'AR generation failed. The artwork was not changed.');
        setGeneration(payload.summary ? { ...payload, confirm: false } : null);
        return;
      }
      setGeneration(payload);
      setMessage('AR meshes were staged privately on the server. They are not customer-visible until you confirm publish.');
    } catch (caught) {
      setError(caught.message);
    } finally {
      setBusy('');
    }
  }

  async function onPublish() {
    if (!generation?.generationId) {
      return;
    }
    const summary = generation.summary || {};
    const confirmed = window.confirm(
      [
        'Publish AR assets to the public ar-assets bucket?',
        `Artwork: ${title || ''} (${artworkId})`,
        `Size: ${summary.physicalLabel || preview.physicalLabel || 'unknown'}`,
        `Aspect mismatch: ${formatPct(summary.deltaPct ?? preview.deltaPct)}`,
        `Version: ${summary.contentHash || 'unknown'}`,
        'Incomplete or invalid assets will not be published.',
      ].join('\n'),
    );
    if (!confirmed) {
      return;
    }
    setBusy('publish');
    setError('');
    try {
      const payload = await postAr('/api/admin/ar/publish', {
        artworkId,
        generationId: generation.generationId,
        confirm: true,
      });
      if (!payload.ok) {
        setError(payload.error || 'AR publishing failed. The previous current version was left unchanged.');
        return;
      }
      setMessage('AR assets are now the current customer version.');
      setGeneration(null);
    } catch (caught) {
      setError(caught.message);
    } finally {
      setBusy('');
    }
  }

  return (
    <section className="space-y-5">
      <h2 className="font-display text-2xl">AR readiness</h2>
      <p className="text-sm text-on-surface-variant">
        Artwork save and gallery upload do not depend on AR. Generation is explicit. Customer publishing is a second confirmation and never uses a browser secret.
      </p>
      <p className="label-sm text-bronze">{preview.label}</p>
      <dl className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="label-sm text-patina">Original image</dt>
          <dd>{pixels ? `${pixels.width} × ${pixels.height} px` : 'Not measured'}</dd>
        </div>
        <div>
          <dt className="label-sm text-patina">Physical size</dt>
          <dd>{preview.physicalLabel || 'Incomplete'}</dd>
        </div>
        <div>
          <dt className="label-sm text-patina">Image aspect</dt>
          <dd>{preview.imageAspect ?? '—'}</dd>
        </div>
        <div>
          <dt className="label-sm text-patina">Physical aspect</dt>
          <dd>{preview.physicalAspect ?? '—'}</dd>
        </div>
        <div>
          <dt className="label-sm text-patina">Mismatch</dt>
          <dd>{preview.deltaPct == null ? '—' : formatPct(preview.deltaPct)}</dd>
        </div>
        <div>
          <dt className="label-sm text-patina">Catalogue status</dt>
          <dd>{status || 'draft'}</dd>
        </div>
      </dl>
      {preview.explanation ? <p className="text-sm text-on-surface-variant">{preview.explanation}</p> : null}
      {!artworkId ? (
        <p className="text-sm text-patina">Save the artwork and a catalogue image before generating AR assets.</p>
      ) : (
        <div className="flex flex-wrap gap-3">
          <button
            className="btn-secondary"
            type="button"
            disabled={Boolean(busy) || !preview.canGenerate}
            onClick={onGenerate}
          >
            {busy === 'generate' ? 'Generating…' : 'Generate AR assets'}
          </button>
          <button
            className="btn-primary"
            type="button"
            disabled={Boolean(busy) || !generation?.ok || !generation?.canPublish}
            onClick={onPublish}
          >
            {busy === 'publish' ? 'Publishing…' : 'Publish AR to customers'}
          </button>
        </div>
      )}
      {generation?.summary ? (
        <div className="notice space-y-2">
          <p className="label-sm text-patina">Generated version (not customer-visible until publish)</p>
          <p className="text-sm">Artwork ID {generation.summary.artworkId}</p>
          <p className="text-sm">{generation.summary.physicalLabel}</p>
          <p className="text-sm">Mismatch {formatPct(generation.summary.deltaPct)}</p>
          <p className="text-sm">Content hash {generation.summary.contentHash}</p>
          <p className="text-sm">GLB {generation.summary.glbBytes} bytes · USDZ {generation.summary.usdzBytes} bytes</p>
        </div>
      ) : null}
      {message ? <p className="notice">{message}</p> : null}
      {error ? <p className="notice notice-error">{error}</p> : null}
    </section>
  );
}
